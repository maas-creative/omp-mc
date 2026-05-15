import * as fs from "node:fs/promises";
import * as path from "node:path";

interface AuditCheckResult {
	name: string;
	command: string[];
	skipped: boolean;
	reason?: string;
	exitCode?: number;
	stdout: string;
	stderr: string;
	durationMs: number;
}

interface AuditEvidence {
	tool: "omp-mc-audit";
	timestamp: string;
	cwd: string;
	result: "pass" | "fail";
	checks: AuditCheckResult[];
}

const cwd = process.cwd();
const auditDir = path.join(cwd, ".omp", "audit");
const decoder = new TextDecoder();

async function pathExists(target: string): Promise<boolean> {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
	}
}

async function hasFeatureFiles(dir: string): Promise<boolean> {
	let entries: fs.Dirent[];
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return false;
	}
	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (await hasFeatureFiles(entryPath)) return true;
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".feature")) return true;
	}
	return false;
}

async function runTextCommand(command: string[]): Promise<string | null> {
	try {
		const proc = Bun.spawn(command, { stdout: "pipe" });
		const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
		return exitCode === 0 ? stdout : null;
	} catch {
		return null;
	}
}

async function getExecutableSearchDirs(): Promise<string[]> {
	const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(segment => segment.length > 0);
	const npmPrefix = await runTextCommand(["npm", "config", "get", "prefix"]);
	if (npmPrefix !== null) {
		dirs.push(path.join(npmPrefix.trim(), "bin"));
	}
	const npmRoot = await runTextCommand(["npm", "root", "-g"]);
	if (npmRoot !== null) {
		dirs.push(path.join(path.dirname(path.dirname(npmRoot.trim())), "bin"));
	}
	return Array.from(new Set(dirs));
}

async function findExecutable(name: string): Promise<string | null> {
	for (const segment of await getExecutableSearchDirs()) {
		const candidate = path.join(segment, name);
		if (await pathExists(candidate)) return candidate;
	}
	return null;
}

async function runCheck(name: string, command: string[], options?: { skip?: boolean; reason?: string }): Promise<AuditCheckResult> {
	if (options?.skip) {
		return {
			name,
			command,
			skipped: true,
			reason: options.reason,
			stdout: "",
			stderr: "",
			durationMs: 0,
		};
	}

	const started = Date.now();
	try {
		const proc = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" });
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).arrayBuffer(),
			new Response(proc.stderr).arrayBuffer(),
			proc.exited,
		]);
		return {
			name,
			command,
			skipped: false,
			exitCode,
			stdout: decoder.decode(stdout),
			stderr: decoder.decode(stderr),
			durationMs: Date.now() - started,
		};
	} catch (err) {
		return {
			name,
			command,
			skipped: false,
			exitCode: 127,
			stdout: "",
			stderr: err instanceof Error ? err.message : String(err),
			durationMs: Date.now() - started,
		};
	}
}

async function writeEvidence(evidence: AuditEvidence): Promise<void> {
	await fs.mkdir(auditDir, { recursive: true });
	const body = `${JSON.stringify(evidence, null, "\t")}\n`;
	await fs.writeFile(path.join(auditDir, "last-run.json"), body);
	const historyName = `${evidence.timestamp.replace(/[:.]/g, "-")}.json`;
	await fs.mkdir(path.join(auditDir, "history"), { recursive: true });
	await fs.writeFile(path.join(auditDir, "history", historyName), body);
}

async function main(): Promise<number> {
	const hasFeatures = await hasFeatureFiles(path.join(cwd, "features"));
	const hasSrc = await pathExists(path.join(cwd, "src"));
	const hasPackages = await pathExists(path.join(cwd, "packages"));
	const hasOpenApi = (await pathExists(path.join(cwd, "openapi.yaml"))) || (await pathExists(path.join(cwd, "openapi.yml")));
	const hasStryker =
		(await pathExists(path.join(cwd, "stryker.conf.js"))) ||
		(await pathExists(path.join(cwd, "stryker.conf.mjs"))) ||
		(await pathExists(path.join(cwd, "stryker.config.json")));
	const hasPackageLock = await pathExists(path.join(cwd, "package-lock.json"));
	const hasBunLock = (await pathExists(path.join(cwd, "bun.lock"))) || (await pathExists(path.join(cwd, "bun.lockb")));

	const cucumber = await findExecutable("cucumber-js");
	const depcruise = await findExecutable("depcruise");
	const spectral = await findExecutable("spectral");
	const stryker = await findExecutable("stryker");
	const npm = await findExecutable("npm");
	const bun = await findExecutable("bun");
	const securityCommand = hasBunLock ? [bun ?? "bun", "audit", "--audit-level=high"] : [npm ?? "npm", "audit", "--audit-level=high"];

	const checks: AuditCheckResult[] = [];
	checks.push(
		await runCheck("gherkin", [cucumber ?? "cucumber-js"], {
			skip: !hasFeatures,
			reason: "No features/**/*.feature files found",
		}),
	);
	checks.push(
		await runCheck("architecture", [depcruise ?? "depcruise", hasSrc ? "src" : "packages"], {
			skip: !hasSrc && !hasPackages,
			reason: "No src or packages directory found",
		}),
	);
	checks.push(
		await runCheck("openapi", [spectral ?? "spectral", "lint", "openapi.yaml"], {
			skip: !hasOpenApi,
			reason: "No openapi.yaml/openapi.yml found",
		}),
	);
	checks.push(
		await runCheck("mutation", [stryker ?? "stryker", "run"], {
			skip: !hasStryker,
			reason: "No Stryker config found",
		}),
	);
	checks.push(
		await runCheck("security", securityCommand, {
			skip: !hasBunLock && !hasPackageLock,
			reason: "No bun.lock/bun.lockb/package-lock.json found",
		}),
	);

	const failed = checks.some(check => !check.skipped && check.exitCode !== 0);
	const evidence: AuditEvidence = {
		tool: "omp-mc-audit",
		timestamp: new Date().toISOString(),
		cwd,
		result: failed ? "fail" : "pass",
		checks,
	};
	await writeEvidence(evidence);

	for (const check of checks) {
		if (check.skipped) {
			console.log(`SKIP ${check.name}: ${check.reason ?? "not applicable"}`);
			continue;
		}
		console.log(`${check.exitCode === 0 ? "PASS" : "FAIL"} ${check.name}: ${check.command.join(" ")}`);
		if (check.exitCode !== 0) {
			if (check.stdout.trim().length > 0) console.log(check.stdout.trimEnd());
			if (check.stderr.trim().length > 0) console.error(check.stderr.trimEnd());
		}
	}
	console.log(`Evidence: ${path.join(".omp", "audit", "last-run.json")}`);
	return failed ? 1 : 0;
}

process.exit(await main());
