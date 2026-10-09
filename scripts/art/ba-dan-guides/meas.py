import numpy as np
def measure(p):
    g=p.geo; sc=1.5
    from guidelib import proj
    F=proj(p.front()); ox,oy=p.anchor
    ym=g['free1']-0.12
    X=proj((g['wx1'],ym,0))[0]-F[0]+ox
    c=int(round(X))
    roof=p.tagmask['roof'][:,c]; pl=p.tagmask['plinth'][:,c]; wall=p.tagmask['wall'][:,c]
    rr=np.nonzero(roof)[0]; 
    # contiguous lowest roof run: top of the first, bottom of the last
    top=rr.min(); bot=rr.max()
    pb=np.nonzero(pl)[0].max()
    ys=np.nonzero(p.sil[:,c])[0]
    return dict(col=c, roof_px=(bot-top+1)/sc, below_px=(pb-bot)/sc, ratio=(bot-top+1)/(pb-bot), plinth_bottom=pb, roof_top=int(top), roof_bottom=int(bot))
