
export type Filter = {
  assetId: string,
  /** asset file path of filter, *_cc.tex or *.ksh */
  file: string,
  /** ranged 0.0–1.0 */
  intensity: number,
  disabled: boolean,
  /** time offset of shader */
  offset: number,
  /** time elapsed speed of shader */
  speed: number,
}

interface IPostProcessor {
  filters: Filter[],
}

export class PostProcessor implements IPostProcessor {
  filters = []
  construct() {

  }


}