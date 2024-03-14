export enum CategoryPrefix {
  SFX = "master/set_sfx/",
  MUSIC = "master/set_music/",
  AMB = "master/set_ambience/",
}

// TODO: i18n
export const formatSoundCategory = (category: string)=> {
  if (category.startsWith(CategoryPrefix.SFX))
    return "音效" 
  else if (category.startsWith(CategoryPrefix.MUSIC))
    return "音乐"
  else if (category.startsWith(CategoryPrefix.AMB))
    return "环境声"
  else
    return category
}

export const formatSoundLength = (lengthms: number)=> {
  if (lengthms < 0) {
    return "无限循环"
  }
  else if (lengthms < 1000) {
    return `${lengthms}毫秒`
  }
  else {
    return `${(lengthms/1000).toFixed(2)}秒`
  }
}