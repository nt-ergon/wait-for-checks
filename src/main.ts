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
    let page = 1

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Check timeout
      if ((new Date().getTime() - startTime.getTime()) / 1000 / 60 > 10) {
        // 10 min at most
        throw new Error('timed out waiting for jobs to finish')
      }

      // Fetch current page
      const pageSize = 100
      const { data: response } = await octokit.rest.checks.listForRef({
        ...github.context.repo,
        filter: 'latest',
        per_page: pageSize,
        page,
        ref: github.context.ref
      })

      const checks = response.check_runs.filter(
        it => it.name !== github.context.job
      )

      // Check if any are incomplete
      if (checks.some(it => it.status !== 'completed')) {
        await wait(100)
        continue
      }

      // Check for errors
      if (checks.some(it => it.conclusion !== 'success')) {
        throw new Error('there were unsuccessful checks')
      }

      // Check if done
      if (response.check_runs.length < pageSize) {
        break
      }

      page += 1
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
