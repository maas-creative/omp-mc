Feature: omp-mc core governance enforcement
  The distribution must enforce specification-first implementation and auditable completion across the monorepo.

  Scenario: Implementation tools are blocked when no Gherkin specification exists
    Given a user asks the agent to modify source code
    And no .feature file exists in the current project
    When the agent attempts to use edit or write
    Then the tool call is blocked with instructions to create a Gherkin specification first

  Scenario: Completion is blocked until the monorepo audit passes
    Given an agent is preparing to mark work complete
    When the agent attempts to resolve the task
    Then the audit command must be run
    And a non-zero audit result prevents completion

  Scenario: Audit evidence is persisted
    Given the audit command has been run
    When the command exits
    Then the exit code, command, timestamp, and check result are written to .omp audit last-run json

  Scenario: Installed omp-mc configuration includes hooks as well as rules and agents
    Given the user runs install.sh
    When omp-mc links configuration into the user config directory
    Then rules, agents, and hooks are installed together
