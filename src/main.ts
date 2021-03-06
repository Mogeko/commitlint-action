import * as core from "@actions/core"
import * as github from "@actions/github"
import lint from "@commitlint/lint"
import load from "@commitlint/load"
import format from "@commitlint/format"
import { LintOutcome } from "@commitlint/types"
import { OctokitResponse } from "@octokit/types"

// Processing config
const getConfig = () => {
  core.debug("Processing config")

  const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE as string
  const input = {
    config: core.getInput("config"),
    configFile: core.getInput("configFile"),
  }

  core.debug(`config: ${input.config}`)
  core.debug(`opt_cwd: ${GITHUB_WORKSPACE}`)
  core.debug(`opt_file: ${input.configFile}`)

  return { config: input.config, opt: { cwd: GITHUB_WORKSPACE, file: input.configFile } }
}

// Get commit message
const getCommitMsg = async () => {
  core.debug("Get commit message")

  type CommitType = OctokitResponse<{ message: string }>

  const { context: cx } = github
  core.debug(`owner: ${cx.repo.owner}`)
  core.debug(`repo: ${cx.repo.repo}`)
  core.debug(`commit_sha: ${cx.sha}`)

  const token = core.getInput("token")
  const octokit = github.getOctokit(token)
  const commit = await octokit.git.getCommit({
    owner: cx.repo.owner,
    repo: cx.repo.repo,
    commit_sha: cx.sha,
  }) as CommitType
  core.debug(`res_status: ${commit.status}`)
  core.debug(`res_data_message: ${commit.data.message}`)

  return commit.data.message
}

// Print result
const printResult = (val: LintOutcome) => {
  core.debug("Print result")

  const fmt = (val: LintOutcome, verbose: boolean) => format({ results: [val] }, {
    color: true,
    helpUrl: "https://github.com/conventional-changelog/commitlint/#what-is-commitlint",
    verbose,
  })
  const bool = (val: string): boolean => (val === "true")

  const strict = bool(core.getInput("strict"))
  const verbose = core.isDebug() ? true : bool(core.getInput("verbose"))
  core.debug(`strict: ${strict}    verbose: ${verbose}`)

  if (val.errors.length) {
    core.info("Failed due to the following errors:")
    core.info(fmt(val, verbose))
    process.exit(1)
  }

  if (strict && val.warnings.length) {
    core.info("Failed due to the following warnings:")
    core.info(fmt(val, verbose))
    process.exit(1)
  }
}

const main = async () => {
  const { config, opt } = getConfig()
  const commitMsg = await getCommitMsg()

  const result = await load({ extends: [config] }, opt)
    .then(async ({ rules }) => {
      return await lint(commitMsg, rules)
        .then(res => {
          printResult(res)
          return res
        })
    })
  
  core.setOutput("COMMITLINT_RESULT", result)

  core.info("All good! 🎉")
}

main()
  .catch(e => {
    core.setFailed(e.massage)
  })
