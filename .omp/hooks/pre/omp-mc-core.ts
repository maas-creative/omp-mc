import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { HookAPI, ToolCallEvent, ToolResultEvent } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

const WRITE_TOOLS = new Set(["edit", "write", "ast_edit"]);
const AUDIT_COMMAND_PATTERN = /(^|\s)(bun\s+run\s+audit|bun\s+scripts\/omp-mc-audit\.ts|omp-mc-audit)(\s|$)/;

interface AuditEvidence {
	tool: string;
	timestamp: string;
	cwd: string;
	result: "pass" | "fail";
	checks: unknown[];
}

async function exists(target: string): Promise<boolean> {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
	}
}

async function containsFeatureFile(dir: string): Promise<boolean> {
	let entries: fs.Dirent[];
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return false;
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		const entryPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (await containsFeatureFile(entryPath)) return true;
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".feature")) return true;
	}
	return false;
}

function getTargetPath(event: ToolCallEvent): string | undefined {
	const value = event.input.path ?? event.input.file;
	return typeof value === "string" ? value : undefined;
}

function isFeatureWrite(event: ToolCallEvent): boolean {
	const targetPath = getTargetPath(event);
	return targetPath !== undefined && targetPath.endsWith(".feature");
}

function getCommand(event: ToolCallEvent | ToolResultEvent): string | undefined {
	const command = event.input.command ?? event.input.op;
	return typeof command === "string" ? command : undefined;
}

function textContent(event: ToolResultEvent): string {
	return event.content
		.map(item => (item.type === "text" && typeof item.text === "string" ? item.text : ""))
		.filter(Boolean)
		.join("\n");
}

async function readAuditEvidence(cwd: string): Promise<AuditEvidence | null> {
	try {
		const text = await fs.readFile(path.join(cwd, ".omp", "audit", "last-run.json"), "utf8");
		const parsed = JSON.parse(text) as Partial<AuditEvidence>;
		if (parsed.result !== "pass" && parsed.result !== "fail") return null;
		return {
			tool: typeof parsed.tool === "string" ? parsed.tool : "unknown",
			timestamp: typeof parsed.timestamp === "string" ? parsed.timestamp : "",
			cwd: typeof parsed.cwd === "string" ? parsed.cwd : cwd,
			result: parsed.result,
			checks: Array.isArray(parsed.checks) ? parsed.checks : [],
		};
	} catch {
		return null;
	}
}

async function writeHookEvidence(cwd: string, command: string, event: ToolResultEvent): Promise<void> {
	const auditDir = path.join(cwd, ".omp", "audit");
	await fs.mkdir(path.join(auditDir, "history"), { recursive: true });
	const timestamp = new Date().toISOString();
	const evidence: AuditEvidence = {
		tool: "omp-mc-hook",
		timestamp,
		cwd,
		result: event.isError ? "fail" : "pass",
		checks: [
			{
				name: event.toolName,
				command,
				isError: event.isError === true,
				output: textContent(event),
			},
		],
	};
	const body = `${JSON.stringify(evidence, null, "\t")}\n`;
	await fs.writeFile(path.join(auditDir, "last-run.json"), body);
	await fs.writeFile(path.join(auditDir, "history", `${timestamp.replace(/[:.]/g, "-")}.json`), body);
}

function resolveBlockReason(audit: AuditEvidence | null): string | undefined {
	if (audit === null) {
		return "omp-mc blocked task completion: no audit evidence found. Run `bun run audit` first to produce a pass result, then retry completion.";
	}
	if (audit.result === "fail") {
		return `omp-mc blocked task completion: the latest audit evidence (${audit.timestamp}) is FAILING. Run \`bun run audit\` and fix failures before applying completion actions.`;
	}
	return undefined;
}

export default function registerOmpMcCore(pi: HookAPI): void {
	// Block edit/write when no Gherkin spec exists
	pi.on("tool_call", async (event, ctx) => {
		if (WRITE_TOOLS.has(event.toolName) && !isFeatureWrite(event)) {
			const hasSpec = await containsFeatureFile(path.join(ctx.cwd, "features"));
			if (!hasSpec) {
				return {
					block: true,
					reason:
						"omp-mc blocked this implementation tool call because no features/**/*.feature specification exists. Create the Gherkin specification first, then retry the code change.",
				};
			}
		}

		// Block resolve (except discard) when audit is missing or failing
		if (event.toolName === "resolve" && event.input.action !== "discard") {
			const audit = await readAuditEvidence(ctx.cwd);
			const reason = resolveBlockReason(audit);
			if (reason) return { block: true, reason };
		}
	});

	// Capture audit command results and persist evidence
	pi.on("tool_result", async (event, ctx) => {
		const command = getCommand(event);
		if (command === undefined || !AUDIT_COMMAND_PATTERN.test(command)) return;
		await writeHookEvidence(ctx.cwd, command, event);
	});

	// Warn on agent start when audit is failing or missing
	pi.on("before_agent_start", async (event, ctx) => {
		const audit = await readAuditEvidence(ctx.cwd);
		if (audit === null) {
			return {
				message: {
					customType: "omp-mc-audit-warning",
					content: "omp-mc: No audit evidence exists yet. Run `bun run audit` before completing work.",
					attribution: "agent",
				},
			};
		}
		if (audit.result === "fail") {
			return {
				message: {
					customType: "omp-mc-audit-warning",
					content: `omp-mc: Previous audit (${audit.timestamp}) is FAILING. Task completion will be blocked until audit passes.`,
					attribution: "agent",
				},
			};
		}
	});

	pi.registerCommand("omp-audit", {
		description: "Run the omp-mc audit pipeline and persist evidence.",
		async handler(_args, ctx) {
			const result = await pi.exec("bun", ["run", "audit"], { cwd: ctx.cwd });
			if (result.exitCode !== 0) {
				throw new Error(result.stderr.length > 0 ? result.stderr : result.stdout);
			}
		},
	});
}
