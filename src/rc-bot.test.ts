import moment from 'moment'
import RCBot from './rc-bot'
import SlackBotService from './services/slackbot-service'
import GithubService from './services/github-service'

describe('GithubService', () => {
  it('throw an error if accessToken is empty', () => {
    expect(() => {
      new GithubService('')
    }).toThrow('accessToken is empty :(')
  })
})

describe('SlackBotService', () => {
  it('throw an error if webHookURL is empty', () => {
    expect(() => {
      new SlackBotService('')
    }).toThrow('webHookURL is empty :(')
  })
})

describe('RCBot', () => {
  let rcBot: RCBot
  let slackBotService: SlackBotService
  let githubService: GithubService

  beforeEach(() => {
    slackBotService = new SlackBotService('mock')
    githubService = new GithubService('mock')
    rcBot = new RCBot(
      {
        organization: 'Spotify',
        baseBranch: 'develop',
        headBranch: 'master'
      },
      githubService,
      slackBotService
    )

    slackBotService.postMessageToReminderChannel = jest.fn()
  })

  function mockAllValues(allRepos, firstCompare = undefined, secondCompare = undefined) {
    jest.spyOn(githubService, 'getAllOrganizationRepos').mockImplementationOnce(() => allRepos)
    jest.spyOn(githubService, 'compareTwoBranches').mockImplementationOnce(() => firstCompare)
    jest.spyOn(githubService, 'compareTwoBranches').mockImplementationOnce(() => secondCompare)
  }

  it('send message to the slack channel about not updated repositories', async () => {
    const allRepos = [
      { name: 'react', owner: { login: 'facebook' } },
      { name: 'typescript', owner: { login: 'microsoft' } }
    ]

    const firstBranchDiff = {
      data: {
        files: ['some.js'],
        commits: [
          {
            author: {
              login: 'Iron Man'
            },
            commit: {
              committer: {
                date: moment().subtract(10, 'days')
              }
            }
          }
        ]
      }
    }

    const secondBranchDiff = {
      data: {
        files: ['some.js'],
        commits: [
          {
            author: {
              login: 'Hulk'
            },
            commit: {
              committer: {
                date: moment().subtract(5, 'days')
              }
            }
          }
        ]
      }
    }

    mockAllValues(allRepos, firstBranchDiff, secondBranchDiff)

    await rcBot.checkBranches()

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledTimes(1)

    const expectedMessage =
      'REPOSITORIES LISTED BELOW ARE NOT UPDATED PROPERLY. PLEASE MERGE MASTER TO DEVELOP BRANCH.\n' +
      '-----------------\n' +
      'Repo: react\n' +
      'Author of not updated commit: Iron Man\n' +
      'Delay: 10 days\n' +
      '-----------------\n' +
      'Repo: typescript\n' +
      'Author of not updated commit: Hulk\n' +
      'Delay: 5 days\n'

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledWith(expectedMessage)
  })

  it('send `good job` message if all repos are correctly updated', async () => {
    const allRepos = [{ name: 'react', owner: { login: 'facebook' } }]
    const firstBranchDiff = { data: { files: [] } }

    mockAllValues(allRepos, firstBranchDiff)

    await rcBot.checkBranches()

    const expectedMessage = 'All your repos are looking well. Good job team :)'
    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledTimes(1)
    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledWith(expectedMessage)
  })

  it('send error message when something went wrong', async () => {
    mockAllValues(() => {
      throw new Error('500')
    })

    await rcBot.checkBranches()

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledTimes(1)
    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledWith(
      'Something went wrong :('
    )
  })

  it('send message only about active repos', async () => {
    const allRepos = [
      { name: 'react', owner: { login: 'facebook' } },
      { name: 'angular-js', owner: { login: 'google' }, archived: true }
    ]

    const firstBranchDiff = {
      data: {
        files: ['some.js'],
        commits: [
          {
            author: {
              login: 'Thor'
            },
            commit: {
              committer: {
                date: moment().subtract(66, 'days')
              }
            }
          }
        ]
      }
    }

    mockAllValues(allRepos, firstBranchDiff, firstBranchDiff)

    await rcBot.checkBranches()

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledTimes(1)

    const expectedMessage =
      'REPOSITORIES LISTED BELOW ARE NOT UPDATED PROPERLY. PLEASE MERGE MASTER TO DEVELOP BRANCH.\n' +
      '-----------------\n' +
      'Repo: react\n' +
      'Author of not updated commit: Thor\n' +
      'Delay: 66 days\n'

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledWith(expectedMessage)
  })

  it('works well with different branches', async () => {
    const allRepos = [{ name: 'react', owner: { login: 'facebook' } }]

    const firstBranchDiff = {
      data: {
        files: ['some.js'],
        commits: [
          {
            author: {
              login: 'Batman'
            },
            commit: {
              committer: {
                date: moment().subtract(5, 'days')
              }
            }
          }
        ]
      }
    }

    mockAllValues(allRepos, firstBranchDiff)

    rcBot = new RCBot(
      {
        organization: 'Github',
        baseBranch: 'replica',
        headBranch: 'main'
      },
      githubService,
      slackBotService
    )
    await rcBot.checkBranches()

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledTimes(1)

    const expectedMessage =
      'REPOSITORIES LISTED BELOW ARE NOT UPDATED PROPERLY. PLEASE MERGE MAIN TO REPLICA BRANCH.\n' +
      '-----------------\n' +
      'Repo: react\n' +
      'Author of not updated commit: Batman\n' +
      'Delay: 5 days\n'

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledWith(expectedMessage)
  })

  it('do not display commits delay in slack message if is equal 0', async () => {
    const allRepos = [{ name: 'react', owner: { login: 'facebook' } }]

    const firstBranchDiff = {
      data: {
        files: ['some.js'],
        commits: [
          {
            author: {
              login: 'Capitan America'
            },
            commit: {
              committer: {
                date: moment()
              }
            }
          }
        ]
      }
    }

    mockAllValues(allRepos, firstBranchDiff)

    await rcBot.checkBranches()

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledTimes(1)

    const expectedMessage =
      'REPOSITORIES LISTED BELOW ARE NOT UPDATED PROPERLY. PLEASE MERGE MASTER TO DEVELOP BRANCH.\n' +
      '-----------------\n' +
      'Repo: react\n' +
      'Author of not updated commit: Capitan America\n'

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledWith(expectedMessage)
  })

  it('throw an error if required dependencies are missing', () => {
    expect(() => {
      rcBot = new RCBot(
        {
          organization: 'Spotify',
          baseBranch: 'develop',
          headBranch: 'master'
        },
        new GithubService(''),
        new SlackBotService('aaa')
      )
    }).toThrow('accessToken is empty :(')

    expect(() => {
      rcBot = new RCBot(
        {
          organization: '',
          baseBranch: 'develop',
          headBranch: 'master'
        },
        new GithubService('aaa'),
        new SlackBotService('aaa')
      )
    }).toThrow('config do not have all required values')
  })

  it('send message only about repos where duration between rc and develop is less than 300 days', async () => {
    const allRepos = [
      { name: 'react', owner: { login: 'facebook' } },
      { name: 'angular-js', owner: { login: 'google' } }
    ]

    const firstBranchDiff = {
      data: {
        files: ['some.js'],
        commits: [
          {
            author: {
              login: 'Thor'
            },
            commit: {
              committer: {
                date: moment().subtract(299, 'days')
              }
            }
          }
        ]
      }
    }

    const secondBranchDiff = {
      data: {
        files: ['some.js'],
        commits: [
          {
            author: {
              login: 'Thor'
            },
            commit: {
              committer: {
                date: moment().subtract(301, 'days')
              }
            }
          }
        ]
      }
    }

    mockAllValues(allRepos, firstBranchDiff, secondBranchDiff)

    await rcBot.checkBranches()

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledTimes(1)

    const expectedMessage =
      'REPOSITORIES LISTED BELOW ARE NOT UPDATED PROPERLY. PLEASE MERGE MASTER TO DEVELOP BRANCH.\n' +
      '-----------------\n' +
      'Repo: react\n' +
      'Author of not updated commit: Thor\n' +
      'Delay: 299 days\n'

    expect(slackBotService.postMessageToReminderChannel).toHaveBeenCalledWith(expectedMessage)
  })
})
