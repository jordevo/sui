import cookieStrategy from '@s-ui/js/lib/cookie'
import localStorageStrategy from './localStorage'
import uuid from 'uuid/v4'

const KEY = 'sui-analytics-anonymous-user-id'

const getAnonymousUserId = function(key) {
  try {
    return cookieStrategy.get(key)
  } catch (error) {
    console.error('[sui-analytics]: couldn\'t get cookie')
  }
  try {
    return localStorageStrategy.getItem(key)
  } catch (error) {
    console.error('[sui-analytics]: couldn\'t get local storage')
  }
  return uuid()
}

const setAnonymousUserId = function(key, userId) {
  try {
    cookieStrategy.set(key, userId)
  } catch (error) {
    console.error('[sui-analytics]: couldn\'t set cookie')
  }
  try {
    localStorageStrategy.setItem(key, userId)
  } catch (error) {
    console.error('[sui-analytics]: couldn\'t set local storage')
  }
}

export default function(key = KEY) {
  const userId = getAnonymousUserId(key)
  setAnonymousUserId(key, userId)
  return userId
}
