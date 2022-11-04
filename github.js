const io = require('@actions/io')
const exec = require('@actions/exec')
const {context, getOctokit} = require('@actions/github')

function splitLines(multilineString) {
  return multilineString
    .split('\n')
    .map(s => s.trim())
    .filter(x => x !== '')
}

async function execute(args, workingDirectory) {
  const gitPath = await io.which('git', true)

  const env = {}
  for (const key of Object.keys(process.env)) {
    env[key] = process.env[key]
  }

  const stdout = []
  const stderr = []

  const options = {
    cwd: workingDirectory,
    env,
    ignoreReturnCode: true,
    listeners: {
      stdout: data => {
        stdout.push(data.toString())
      },
      stderr: data => {
        stderr.push(data.toString())
      }
    }
  }

  const exitCode = await exec.exec(`"${gitPath}"`, args, options)
  return {
    exitCode: exitCode,
    stdout: stdout.join(''),
    stderr: stderr.join('')
  }
}

const fetch = async function (workingDirectory) {
  await execute(['fetch', '--all'], workingDirectory)
}

const getCurrentBranch = async function (workingDirectory) {
  const symbolicRefResult = await execute(
    ['symbolic-ref', 'HEAD', '--short'],
    workingDirectory
  )
  if (symbolicRefResult.exitCode === 0) {
    return symbolicRefResult.stdout.trim()
  } else {
    throw new Error('Current branch cannot be determined')
  }
}

const listBranches = async function (workingDirectory, branchType) {
  const branches = await execute(['branch', '-r', '--list'], workingDirectory)
  if (branches.exitCode === 0) {
    return splitLines(branches.stdout).filter(branch =>
      branch.includes(branchType)
    )
  } else {
    return []
  }
}

const merge = async function (token, from, to) {
  const octokit = getOctokit(token)

  const response = await octokit.rest.repos.merge({
    ...context.repo,
    base: to,
    head: from
  })

  const newMasterSha = response.data.sha

  return newMasterSha
}

const getCurrentPullRequest = async function (token, owner, repo, from, to) {
  const octokit = getOctokit(token)

  const {data: currentPulls} = await octokit.rest.pulls.list({
    owner,
    repo
  })

  const currentPull = currentPulls.find(pull => {
    return pull.head.ref === from && pull.base.ref === to
  })

  return currentPull
}

const hasContentDifference = async function (token, owner, repo, from, to) {
  const octokit = getOctokit(token)

  const {data: response} = await octokit.rest.repos.compareCommits({
    owner,
    repo,
    base: to,
    head: from,
    page: 1,
    per_page: 1
  })

  return response.files !== undefined && response.files.length > 0
}

const createPullRequest = async function (token, owner, repo, from, to) {
  const octokit = getOctokit(token)

  const {data: pullRequest} = await octokit.rest.pulls.create({
    owner,
    repo,
    head: from,
    base: to,
    title: `sync: ${from} to ${to}`,
    body: `sync-branches: New code has just landed in ${from}, so let's bring ${to} up to speed!`,
    draft: false
  })

  return pullRequest
}

module.exports = {
  fetch,
  getCurrentBranch,
  listBranches,
  merge,
  getCurrentPullRequest,
  hasContentDifference,
  createPullRequest
}
