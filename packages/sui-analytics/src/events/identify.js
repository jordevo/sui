import context from './common/context'
import getAnonymousId from '../anonymousUser'

export default data => ({
  anonymousId: getAnonymousId(),
  context,
  originalTimestamp: new Date().toISOString(),
  traits: {...data.traits},
  userId: data.userId
})
