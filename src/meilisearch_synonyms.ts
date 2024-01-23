const SYNONYMS = [
  "威尔逊   威吊   科学家",
  "麦斯威尔   老麦",
  "薇克巴顿   奶奶   老奶奶",
  "wx78  wx-78  机器人",
  "薇格弗德  武神  女武神  瓦基里",
  "沃特  鱼人",
  "薇洛  火女",
  "韦伯  蜘蛛人",
  // ""
]

export const SYNONYMS_MAP = {}

SYNONYMS.forEach(terms=> {
  let list = terms.trim().split(/\s+/)
  list.forEach((v)=> {
    SYNONYMS_MAP[v] = list.filter(vv=> vv !== v)
  })
})