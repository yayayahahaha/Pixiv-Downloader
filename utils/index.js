const fs = require('fs')
const qs = require('qs')

const { checkAndRead } = require('./path.js')
const { getArtWorks, getPhotos } = require('../api/index.js')
const { TaskSystem } = require('npm-flyc')

async function getParams(envPath = './input.json') {
  const [env, envError] = await checkAndRead(envPath)
  if (envError) {
    console.error('[ERROR] 缺少 input.json! 請從 input.json.default 複製與修改')
    return {}
  }
  return env
}

async function getAllArtWorks(config) {
  const { PHPSESSID, keyword, totalPages } = config
  const tasks = _createGetArtWorksTasks({
    PHPSESSID,
    keyword,
    totalPages,
  }).slice(0, 1) // TODO testing codes

  const taskFactory = new TaskSystem(tasks, 5, { randomDelay: 1000 /* 毫秒 */ })
  const taskResults = await taskFactory.doPromise()

  return taskResults.reduce((list, { data: [data, error] }) => {
    if (error) return list
    const {
      data: { data: artWorks },
    } = data
    return list.concat(artWorks)
  }, [])
}

async function getAllPhotos(payload) {
  const { PHPSESSID, artWorks } = payload
  const tasks = _createGetPhotosTasks({ PHPSESSID, artWorks })

  const taskFactory = new TaskSystem(tasks, 5, { randomDelay: 1000 })
  const taskResults = await taskFactory.doPromise()

  return taskResults.reduce((list, { data }) => list.concat([data]), [])
}
function _createGetPhotosTasks(config = {}) {
  const { PHPSESSID, artWorks } = config
  return artWorks.map((artWork) => {
    const { id: artWorkId, userName, userId, title } = artWork
    return async function () {
      const [photoInfo, error] = await getPhotos(PHPSESSID, artWorkId)
      if (error) return [null, error]
      return { userName, userId, title, ...photoInfo, artWorkId }
    }
  })
}

function _createGetArtWorksTasks(config = {}) {
  const { PHPSESSID, keyword, totalPages } = config
  return [...Array(totalPages)].map((n, i) => {
    return async () => {
      const page = `${i + 1}`
      const [data, error] = await getArtWorks(PHPSESSID, keyword, page)
      if (error) return [null, { page, error }]
      return [{ page, data }, null]
    }
  })
}

/**
 * @function getKeywordsInfoUrl
 * @description get keyword fetch url
 * @return url<string>
 * */
function getKeywordsInfoUrl(keyword, page = 1) {
  const basicUrl = `https://www.pixiv.net/ajax/search/artworks/${keyword}`
  const query = {
    word: keyword,
    order: 'date',
    mode: 'all',
    p: page,
    s_mode: 's_tag',
    type: 'all',
  }

  const url = `${basicUrl}?${qs.stringify(query)}`
  return encodeURI(url)
}

/**
 * @typedef InputInfo
 * @property keyword <string> - search keyword
 * @property likedLevel <string> - max download liked-level
 * @property maxPage <string> - TODO max fetch page
 * @property PHPSESSID <string> - session
 * */
/**
 * @function inputChecker
 * @description check does input.json has needed parameters or not
 * @return [parameters<InputInfo>, errorMessage<string>]
 * */
function inputChecker() {
  let errorMessage = ''

  if (!fs.existsSync('./input.json')) {
    errorMessage = '請修改 input.json\n'
    return [null, errorMessage]
  }
  const contents = fs.readFileSync('./input.json')
  const inputJSON = JSON.parse(contents)

  const keyword = inputJSON.keyword
  const likedLevel =
    typeof inputJSON.likedLevel === 'number' ? inputJSON.likedLevel : 500
  const maxPage = typeof inputJSON.maxPage === 'number' ? inputJSON.maxPage : 0
  const PHPSESSID = inputJSON.PHPSESSID

  if (!keyword) {
    errorMessage = '請在 input.json 檔裡輸入關鍵字\n'
    return [null, errorMessage]
  }
  if (!PHPSESSID) {
    errorMessage = '請在 input.json 檔裡輸入SESSID\n'
    return [null, errorMessage]
  }

  return [
    {
      keyword,
      likedLevel,
      maxPage,
      PHPSESSID,
    },
    null,
  ]
}

module.exports = {
  inputChecker,
  getKeywordsInfoUrl,
  getParams,
  getAllArtWorks,
  getAllPhotos,
}
