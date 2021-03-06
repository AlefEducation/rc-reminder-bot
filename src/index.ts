import RCBot from './rc-bot'
import SlackBotService from './services/slackbot-service'
import GithubService from './services/github-service'

const rcBot = new RCBot(
  {
    organization: process.env.ORGANIZATION_NAME,
    baseBranch: process.env.BASE_BRANCH,
    headBranch: process.env.HEAD_BRANCH
  },
  new GithubService(process.env.GH_ACCESS_TOKEN),
  new SlackBotService(process.env.SLACK_CHANNEL_WEBHOOK_URL)
)
rcBot.checkBranches()
