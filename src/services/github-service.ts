import { Octokit } from '@octokit/rest'
import { ReposListForOrgResponseData } from '@octokit/types/dist-types/generated/Endpoints'
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/parameters-and-response-types'

type compareTwoBranchesParams = RestEndpointMethodTypes['repos']['compareCommits']['parameters']
type compareTwoBranchesResponse = RestEndpointMethodTypes['repos']['compareCommits']['response']

export default class GithubService {
  private githubService: Octokit

  constructor(accessToken: string) {
    if (!accessToken?.length) {
      throw new Error('accessToken is empty :(')
    }
    this.githubService = new Octokit({ auth: accessToken })
  }

  async getAllOrganizationRepos(organization: string): Promise<ReposListForOrgResponseData> {
    const allRepos = []

    let currentData = []
    for (let i = 0; i === 0 || currentData.length > 0; i++) {
      const { data: repos } = await this.githubService.repos.listForOrg({
        org: organization,
        page: i
      })
      currentData = repos
      allRepos.push(...repos)
    }
    return allRepos
  }

  compareTwoBranches(params: compareTwoBranchesParams): Promise<compareTwoBranchesResponse> {
    return this.githubService.repos.compareCommits(params)
  }
}
