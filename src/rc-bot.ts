import moment from 'moment'
import GithubService from './services/github-service'
import SlackBotService from './services/slackbot-service'
import { ReposListForOrgResponseData } from '@octokit/types'

type RepoInfo = {
  repoName: string
  commitsCount: number
  authors: string[]
  delay: number
}

type RCBotConfig = {
  baseBranch: string
  headBranch: string
  organization: string
}

export default class RCBot {
  constructor(
    private config: RCBotConfig,
    private githubService: GithubService,
    private slackBotService: SlackBotService
  ) {
    const hasAllRequiredValues =
      config.organization.length && config.headBranch.length && config.baseBranch.length
    if (!hasAllRequiredValues) {
      throw new Error('config do not have all required values')
    }
  }

  async checkBranches(): Promise<void> {
    try {
      const allOrganizationRepos = await this.githubService.getAllOrganizationRepos(
        this.config.organization
      )
      const infosFromAffectedBranches = await this.getInfosFromAffectedBranches(
        allOrganizationRepos
      )

      if (!infosFromAffectedBranches.length) {
        const goodJobMessage = 'All your repos are looking well. Good job team :)'
        await this.slackBotService.postMessageToReminderChannel(goodJobMessage)
        return
      }

      const reminderMessage = this.getReminderMessage(infosFromAffectedBranches)
      await this.slackBotService.postMessageToReminderChannel(reminderMessage)
    } catch (e) {
      await this.slackBotService.postMessageToReminderChannel('Something went wrong :(')
    }
  }

  async getInfosFromAffectedBranches(repos: ReposListForOrgResponseData): Promise<RepoInfo[]> {
    const allBranchesResponses = repos.map(async (repo) => {
      if (repo.archived) return null

      try {
        const compareData = await this.githubService.compareTwoBranches({
          owner: repo.owner.login,
          repo: repo.name,
          base: this.config.baseBranch,
          head: this.config.headBranch
        })

        const { files = [], commits = [] } = compareData.data

        if (!files.length) return null

        const allAuthors = commits.map((commit) => commit?.author?.login).filter(Boolean)
        const authors = [...new Set(allAuthors)]

        const current = moment()
        const past = moment(commits[0].commit.committer.date)
        const firstCommitDelay = current.diff(past, 'days')

        return {
          repoName: repo.name,
          commitsCount: commits.length,
          authors,
          delay: firstCommitDelay
        }
      } catch (e) {
        return null
      }
    })

    const allBranchesInfos = await Promise.all(allBranchesResponses)
    return allBranchesInfos.filter(Boolean).filter((repo) => repo.delay < 300)
  }

  getReminderMessage(repos: RepoInfo[]): string {
    let message =
      'REPOSITORIES LISTED BELOW ARE NOT UPDATED PROPERLY. ' +
      `PLEASE MERGE ${this.config.headBranch.toUpperCase()} TO ${this.config.baseBranch.toUpperCase()} BRANCH.\n`

    repos.forEach((repo) => {
      const { authors, repoName, commitsCount } = repo

      const authorTitle = `Author${authors.length > 1 ? 's' : ''}`
      const commitTitle = `commit${commitsCount > 1 ? 's' : ''}`
      const userTitle = `${authors.join(', ')}`
      message += '-----------------\n'
      message += `Repo: ${repoName}\n`
      message += `${authorTitle} of not updated ${commitTitle}: ${userTitle}\n`

      if (repo.delay) message += `Delay: ${repo.delay} day${repo.delay > 1 ? 's' : ''}\n`
    })

    return message
  }
}
