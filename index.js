const core = require('@actions/core')
const path = require('path')
const {tryToMerge} = require('./automerger.js')
const {
  fetch,
  getCurrentBranch,
  listBranches,
  merge,
  getCurrentPullRequest,
  hasContentDifference,
  createPullRequest
} = require('./github.js')

async function run() {
  try {
    const githubWorkspacePath = process.env['GITHUB_WORKSPACE']

    if (!githubWorkspacePath) {
      throw new Error('GITHUB_WORKSPACE not defined')
    }

    core.info(`GITHUB_WORKSPACE: ${githubWorkspacePath}`)

    const repoPath = path.resolve(githubWorkspacePath)

    const githubRepository = process.env['GITHUB_REPOSITORY']

    if (!githubRepository) {
      throw new Error('GITHUB_REPOSITORY not defined')
    }

    const [owner, repo] = githubRepository.split('/')

    core.info(`owner: ${owner} repository: ${repo}`)

    const releaseBranchType = core.getInput('release_branch_type')

    const developBranch = core.getInput('develop_branch')

    const token = core.getInput('github_token')

    await tryToMerge({
      repoPath,
      releaseBranchType,
      developBranch,
      getCurrentBranch,
      fetch,
      listBranches,
      token,
      merge,
      owner,
      repo,
      getCurrentPullRequest,
      hasContentDifference,
      createPullRequest
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
