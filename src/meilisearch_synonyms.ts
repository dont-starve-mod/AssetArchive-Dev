const SYNONYMS = [
  ["威尔逊", "威吊", "科学家"],
  ["麦斯威尔", "老麦"],
]

export const SYNONYMS_MAP = {}

SYNONYMS.forEach(terms=> {
  terms.forEach((v)=> {
    SYNONYMS_MAP[v] = terms.filter(vv=> vv !== v)
  })
})