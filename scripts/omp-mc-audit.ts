import * as fs from "node:fs/promises";
import * as path from "node:path";
import { YAML } from "bun";

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

type CheckMode = "required" | "warn" | "auto" | "off";

interface AuditProfile {
	gherkin: CheckMode;
	architecture: CheckMode;
	openapi: CheckMode;
	mutation: CheckMode;
	security: CheckMode;
}

interface AuditProfileConfig {
	profiles: Record<string, AuditProfile>;
}

const DEFAULT_PROFILE: AuditProfile = {
	gherkin: "auto",
	architecture: "auto",
	openapi: "auto",
	mutation: "off",
	security: "required",
};

async function resolveProfile(): Promise<{ name: string; profile: AuditProfile }> {
	const envName = process.env.OMP_AUDIT_PROFILE;
	const pkgJsonPath = path.join(cwd, "package.json");
	let pkgName: string | undefined;
	try {
		const pkg = JSON.parse(await Bun.file(pkgJsonPath).text());
		pkgName = typeof pkg?.omp?.auditProfile === "string" ? pkg.omp.auditProfile : undefined;
	} catch { /* ignore */ }
	const wanted = envName ?? pkgName ?? "default";

	const profilePath = path.join(cwd, ".omp", "audit-profile.yaml");
	try {
		const raw = await Bun.file(profilePath).text();
		const config = YAML.parse(raw) as AuditProfileConfig;
		if (config?.profiles?.[wanted]) {
			return { name: wanted, profile: config.profiles[wanted] };
		}
		if (wanted !== "default" && config?.profiles?.default) {
			return { name: `default (${wanted} not found)`, profile: config.profiles.default };
		}
	} catch { /* use built-in default */ }

	return { name: "default", profile: DEFAULT_PROFILE };
}

function modeAndName(name: string, mode: CheckMode, hasArtifact: boolean): { skip: boolean; isWarn: boolean; checkName: string } {
	if (mode === "off") return { skip: true, isWarn: false, checkName: `${name} (off)` };
	if (mode === "auto" && !hasArtifact) return { skip: true, isWarn: false, checkName: `${name} (no artifact)` };
	const isWarn = mode === "warn";
	return { skip: false, isWarn, checkName: `${name}${isWarn ? " (warn)" : ""}` };
}

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
	const profile = await resolveProfile();
	console.log(`Profile: ${profile.name}`);

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
	const securityCommand = hasBunLock ? ["bun", "audit", "--audit-level=high"] : ["npm", "audit", "--audit-level=high"];

	const pf = profile.profile;
	const modeG = modeAndName("gherkin", pf.gherkin, hasFeatures);
	const modeA = modeAndName("architecture", pf.architecture, hasSrc || hasPackages);
	const modeO = modeAndName("openapi", pf.openapi, hasOpenApi);
	const modeM = modeAndName("mutation", pf.mutation, hasStryker);
	const modeS = modeAndName("security", pf.security, hasBunLock || hasPackageLock);

	const checks: AuditCheckResult[] = [];
	checks.push(
		await runCheck(modeG.checkName, [cucumber ?? "cucumber-js"], {
			skip: modeG.skip,
			reason: modeG.skip ? "Not required by profile or no artifact" : undefined,
		}),
	);
	checks.push(
		await runCheck(modeA.checkName, [depcruise ?? "depcruise", hasSrc ? "src" : "packages"], {
			skip: modeA.skip,
			reason: modeA.skip ? "Not required by profile or no artifact" : undefined,
		}),
	);
	checks.push(
		await runCheck(modeO.checkName, [spectral ?? "spectral", "lint", "openapi.yaml"], {
			skip: modeO.skip,
			reason: modeO.skip ? "Not required by profile or no artifact" : undefined,
		}),
	);
	checks.push(
		await runCheck(modeM.checkName, [stryker ?? "stryker", "run"], {
			skip: modeM.skip,
			reason: modeM.skip ? "Not required by profile or no artifact" : undefined,
		}),
	);
	checks.push(
		await runCheck(modeS.checkName, securityCommand, {
			skip: modeS.skip,
			reason: modeS.skip ? "Not required by profile or no artifact" : undefined,
		}),
	);

	const blockers: Array<{ name: string; isWarn: boolean }> = [
		{ name: modeG.checkName, isWarn: modeG.isWarn },
		{ name: modeA.checkName, isWarn: modeA.isWarn },
		{ name: modeO.checkName, isWarn: modeO.isWarn },
		{ name: modeM.checkName, isWarn: modeM.isWarn },
		{ name: modeS.checkName, isWarn: modeS.isWarn },
	];
	const failed = checks.some(check => {
		if (check.skipped) return false;
		if (check.exitCode === 0) return false;
		const b = blockers.find(b => check.name === b.name);
		return b === undefined || !b.isWarn;
	});
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
