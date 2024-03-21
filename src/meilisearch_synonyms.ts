const SYNONYMS = [
  "威尔逊   威吊    科学家",
  "伍迪     伐木工",
  "薇诺娜   女工",
  "麦斯威尔  老麦",
  "薇克巴顿  奶奶    老奶奶",
  "wx78     wx-78  机器人",
  "薇格弗德  武神    女武神    瓦基里",
  "沃尔夫冈 大力士",
  "沃特     鱼人",
  "薇洛     火女",
  "韦伯     蜘蛛人",
  "火堆     火坑",



  "龙舟比赛  赛龙舟",
  "猪年     猪王年",
  "牛年     皮弗娄牛年",
  "龙年     龙蝇年",
  "鼠年     胡萝卜鼠年",
  "裂隙       裂缝",
  // ""
]

export const SYNONYMS_MAP = {}

SYNONYMS.forEach(terms=> {
  let list = terms.trim().split(/\s+/)
  list.forEach((v)=> {
    SYNONYMS_MAP[v] = list.filter(vv=> vv !== v)
  })
})