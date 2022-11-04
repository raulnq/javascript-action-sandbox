const core = require('@actions/core')
const semver = require('semver')
const cleanSemver = require('clean-semver')

function IsBranchOfType(branch, type) {
  return branch.includes(type)
}

function IsThereBranch(branches, branch) {
  return branches.some(b => b.includes(branch))
}

function toSemver(versions, options = {}) {
  const {includePrereleases = true, clean = true} = options

  let sortedVersions = versions
    .map(version => version.trim())
    .map(version => [version, cleanSemver(version)])
    .filter(version => version[1])
    .sort((a, b) => semver.rcompare(a[1], b[1]))

  if (!includePrereleases) {
    sortedVersions = sortedVersions.filter(
      version => semver.prerelease(version[1]) === null
    )
  }

  if (clean) {
    return sortedVersions.map(version => version[1])
  }

  return sortedVersions.map(([version]) => version)
}

function getTargetBranch(branches, currentBranch, developBranch) {
  const versions = toSemver(branches)
  let nextBranch = ''
  const reversedVersions = versions.reverse()
  let nextVersionIndex = -1
  for (let index = 0; index < reversedVersions.length; index++) {
    const version = reversedVersions[index]
    if (currentBranch.includes(version)) {
      nextVersionIndex = index + 1
      break
    }
  }

  if (nextVersionIndex < reversedVersions.length && nextVersionIndex !== -1) {
    const nextVersion = reversedVersions[nextVersionIndex]
    for (const branch of branches) {
      if (branch.includes(nextVersion)) {
        nextBranch = branch.replace('origin/', '')
        break
      }
    }
  } else {
    nextBranch = developBranch
  }

  return nextBranch
}

const tryToMerge = async function ({
  repoPath,
  releaseBranchType,
  developBranch,
  getCurrentBranch,
  fetch,
  listBranches,
  token,
  merge,
  owner,
  repository,
  getCurrentPullRequest,
  hasContentDifference,
  createPullRequest
}) {
  const currentBranch = await getCurrentBranch(repoPath)

  if (!IsBranchOfType(currentBranch, releaseBranchType)) {
    core.info(
      `The branch ${currentBranch} is not a ${releaseBranchType} branch type`
    )

    return ''
  }

  await fetch(repoPath)

  const branches = await listBranches(repoPath, releaseBranchType)

  if (!IsThereBranch(branches, developBranch)) {
    core.info(`Missing ${developBranch} branch`)

    return ''
  }

  const targetBranch = getTargetBranch(branches, currentBranch, developBranch)

  try {
    core.info(`Merge branch:${currentBranch} to: ${targetBranch}`)

    const hash = await merge(token, currentBranch, targetBranch)

    core.info(`Commit ${hash}`)

    return hash
  } catch (error) {
    core.info(
      `Merge branch:${currentBranch} to: ${targetBranch} failed:${error.message}`
    )

    const currentPullRequest = await getCurrentPullRequest(
      token,
      owner,
      repository,
      currentBranch,
      targetBranch
    )

    if (currentPullRequest) {
      core.info(
        `There is already a pull request (${currentPullRequest.number}) from ${currentBranch} to ${targetBranch}. You can view it here: ${currentPullRequest.url}`
      )

      return ''
    }

    if (
      !(await hasContentDifference(
        token,
        owner,
        repository,
        currentBranch,
        targetBranch
      ))
    ) {
      core.info(
        `There is no content difference between ${currentBranch} and ${targetBranch}.`
      )

      return ''
    }

    const pullRequest = await createPullRequest(
      token,
      owner,
      repository,
      currentBranch,
      targetBranch
    )

    core.info(
      `Pull request (${pullRequest.number}) successful! You can view it here: ${pullRequest.url}`
    )

    return pullRequest.url
    /*if (reviewers.length > 0) {
  octokit.rest.pulls.requestReviewers({
    owner,
    repo,
    pull_number: pullRequest.number,
    reviewers
  })
    }*/
  }
}

module.exports = {tryToMerge, getTargetBranch}
