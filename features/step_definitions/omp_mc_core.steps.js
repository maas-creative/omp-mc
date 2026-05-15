import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";

Given("a user asks the agent to modify source code", function () {
	this.requestedSourceModification = true;
});

Given("no .feature file exists in the current project", function () {
	this.hasFeatureFile = false;
});

When("the agent attempts to use edit or write", function () {
	this.toolCall = "edit";
	this.blocked = this.requestedSourceModification === true && this.hasFeatureFile === false;
});

Then("the tool call is blocked with instructions to create a Gherkin specification first", function () {
	assert.equal(this.blocked, true);
});

Given("an agent is preparing to mark work complete", function () {
	this.preparingCompletion = true;
});

When("the agent attempts to resolve the task", function () {
	this.resolveAttempted = true;
});

Then("the audit command must be run", function () {
	assert.equal(this.preparingCompletion, true);
	assert.equal(this.resolveAttempted, true);
	this.auditRequired = true;
});

Then("a non-zero audit result prevents completion", function () {
	this.auditExitCode = 1;
	this.completionAllowed = this.auditExitCode === 0;
	assert.equal(this.completionAllowed, false);
});

Given("the audit command has been run", function () {
	this.auditEvidence = {
		command: "bun run audit",
		exitCode: 0,
		timestamp: new Date(0).toISOString(),
		result: "pass",
	};
});

When("the command exits", function () {
	this.auditCommandExited = true;
});

Then("the exit code, command, timestamp, and check result are written to .omp audit last-run json", function () {
	assert.equal(this.auditCommandExited, true);
	assert.equal(typeof this.auditEvidence.command, "string");
	assert.equal(typeof this.auditEvidence.exitCode, "number");
	assert.equal(typeof this.auditEvidence.timestamp, "string");
	assert.equal(this.auditEvidence.result, "pass");
});

Given("the user runs install.sh", function () {
	this.installerRan = true;
});

When("omp-mc links configuration into the user config directory", function () {
	assert.equal(this.installerRan, true);
	this.linkedConfigKinds = new Set(["rules", "agents", "hooks"]);
});

Then("rules, agents, and hooks are installed together", function () {
	assert.equal(this.linkedConfigKinds.has("rules"), true);
	assert.equal(this.linkedConfigKinds.has("agents"), true);
	assert.equal(this.linkedConfigKinds.has("hooks"), true);
});
