import * as core from '@actions/core'
import * as github from '@actions/github'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const octokit = github.getOctokit(core.getInput('token'))

    // 1. Wait for no more checks in progress or requested
    const startTime = new Date()
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: anyJob } = await octokit.rest.checks.listForRef({
        ...github.context.repo,
        per_page: 1,
        page: 1,
        ref: github.context.ref
      })
      const { data: queued } = await octokit.rest.checks.listForRef({
        ...github.context.repo,
        status: 'queued',
        per_page: 1,
        page: 1,
        ref: github.context.ref
      })
      const { data: inProgress } = await octokit.rest.checks.listForRef({
        ...github.context.repo,
        status: 'in_progress',
        per_page: 1,
        page: 1,
        ref: github.context.ref
      })
      if (
        anyJob.total_count > 0 &&
        queued.total_count === 0 &&
        inProgress.total_count === 0
      ) {
        break
      }
      if ((new Date().getTime() - startTime.getTime()) / 1000 / 60 > 10) {
        // 10 min at most
        throw new Error('timed out waiting for jobs to finish')
      }
      await wait(100)
    }

    let page = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const pageSize = 100
      const { data: checks } = await octokit.rest.checks.listForRef({
        ...github.context.repo,
        filter: 'latest',
        per_page: pageSize,
        page,
        ref: github.context.ref
      })
      page += 1

      if (checks.check_runs.some(it => it.conclusion !== 'success')) {
        throw new Error('there were unsuccessful checks')
      }

      if (checks.check_runs.length < pageSize) {
        break
      }
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }

  async function wait(millis: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => resolve(), millis)
    })
  }
}
