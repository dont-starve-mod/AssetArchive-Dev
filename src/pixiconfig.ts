import { settings } from "pixi.js"
import { Transform } from "pixi.js"

settings.RESOLUTION = window.devicePixelRatio
settings.RENDER_OPTIONS = {
  ...settings.RENDER_OPTIONS,
  antialias: true,
  backgroundAlpha: 0.0,
  preserveDrawingBuffer: true,
}

/** override default methods to hook affine matrix */
Transform.prototype.updateTransform = function(parentTransform)
{
    const lt = this.localTransform;
    const affine = this.affineTransform;

    if (affine){
      if (affine._flag) return  
      lt.a = affine[0]
      lt.b = affine[1]
      lt.c = affine[2]
      lt.d = affine[3]
      lt.tx = affine[4] 
      lt.ty = affine[5]
      affine._flag = true
      this._parentID = -1
    }
    else if (this._localID !== this._currentLocalID)
    {
        // get the matrix values of the displayobject based on its transform properties..
        lt.a = this._cx * this.scale.x;
        lt.b = this._sx * this.scale.x;
        lt.c = this._cy * this.scale.y;
        lt.d = this._sy * this.scale.y;

        lt.tx = this.position.x - ((this.pivot.x * lt.a) + (this.pivot.y * lt.c));
        lt.ty = this.position.y - ((this.pivot.x * lt.b) + (this.pivot.y * lt.d));
        this._currentLocalID = this._localID;

        // force an update..
        this._parentID = -1;
    }

    if (this._parentID !== parentTransform._worldID)
    {
        // concat the parent matrix with the objects transform.
        const pt = parentTransform.worldTransform;
        const wt = this.worldTransform;

        wt.a = (lt.a * pt.a) + (lt.b * pt.c);
        wt.b = (lt.a * pt.b) + (lt.b * pt.d);
        wt.c = (lt.c * pt.a) + (lt.d * pt.c);
        wt.d = (lt.c * pt.b) + (lt.d * pt.d);
        wt.tx = (lt.tx * pt.a) + (lt.ty * pt.c) + pt.tx;
        wt.ty = (lt.tx * pt.b) + (lt.ty * pt.d) + pt.ty;

        this._parentID = parentTransform._worldID;

        // update the id of the transform..
        this._worldID++;
    }
}