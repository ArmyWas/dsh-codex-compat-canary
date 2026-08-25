# Security policy

## Data handled

The canary reads two public DeepSeek Harness source files, package metadata, and generated Codex JSON schemas. A local-source run reads the same files from the supplied checkout. Reports omit the local source path and contain no prompts, sessions, model responses, or credentials.

`GITHUB_TOKEN` is optional and is used only as an authorization header for GitHub API reads. It is never copied into the report or command output.

## Executed code

Schema generation executes the selected published `@openai/codex` npm package through `npm exec`. Target versions must be exact semantic versions, except that `latest` is resolved to an exact registry version before execution. Use an approved package mirror or the offline schema options when your environment cannot execute registry packages.

DeepSeek Harness source is parsed as text and is never executed. The canary never edits a Harness checkout, profile, lockfile, credential store, or session database.

## Reporting a vulnerability

Open a private GitHub security advisory for vulnerabilities that could expose credentials, execute an unintended package or command, escape the selected output directory, or include sensitive local data in a report. Use a normal issue for incorrect compatibility classifications that do not create a security impact.
