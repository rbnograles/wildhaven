"""Town plans and true diagonal terrain paths for the Spring authoring map."""
import numpy as np


NEW_ART = {'town-hall': 400, 'country-inn': 350, 'farm-barn': 260,
           'market-stall': 280, 'village-well': 120,
           'fence-horizontal': 42, 'fence-vertical': 216}


def paint_line(corners, start, end, width):
    """Rasterize a world-space road into shared terrain corners, at any angle."""
    ax, ay = start
    bx, by = end
    x0 = max(0, int((min(ax, bx)-width)/64))
    y0 = max(0, int((min(ay, by)-width)/64))
    x1 = min(corners.shape[1], int((max(ax, bx)+width)/64)+2)
    y1 = min(corners.shape[0], int((max(ay, by)+width)/64)+2)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    dx, dy = bx-ax, by-ay
    t = np.clip(((xx*64-ax)*dx+(yy*64-ay)*dy)/max(1, dx*dx+dy*dy), 0, 1)
    corners[y0:y1, x0:x1] |= (xx*64-ax-t*dx)**2+(yy*64-ay-t*dy)**2 <= (width/2)**2


def plan_towns(road, corner, wet, settlements):
    h, w = road.shape
    trails = np.zeros((h+1, w+1), dtype=bool)
    bounds, buildings, fences, gates, zones = [], [], [], [], []
    for name, sx, sy in settlements:
        cx, cy = round(sx/64)*64+32, round(sy/64)*64+32
        major = name == 'Hollowstead'
        rx, ry = (23, 21) if major else (10, 10)
        left, right, top, bottom = cx-rx*64, cx+rx*64, cy-ry*64, cy+ry*64
        bounds.append((left-64, top-64, right+64, bottom+64))
        zones.append(dict(name=name, x=sx, y=sy, tier='major' if major else 'small'))
        road[int((top-64)//64):int((bottom+64)//64)+1, int((left-64)//64):int((right+64)//64)+1] = False
        # Perimeter access collects old country roads and directs them to clear gates.
        for inset in (-128, 128):
            a,b,c,d = left+inset,right-inset,top+inset,bottom-inset
            for p,q in (((a,c),(b,c)),((b,c),(b,d)),((b,d),(a,d)),((a,d),(a,c))):
                paint_line(trails,p,q,100 if inset < 0 else 120)
        for p,q in (((cx,cy-3*64 if major else top-160),(cx,bottom+160)),((left-160,cy),(right+160,cy))):
            paint_line(trails,p,q,170 if major else 120)
        if major:
            paint_line(trails,(cx,top-160),(cx,cy-18*64),140)
            for side in (-1,1):
                approach=[(cx,cy-18*64),(cx+side*7*64,cy-17*64),(cx+side*7*64,cy-5*64),(cx,cy-3*64)]
                for p,q in zip(approach,approach[1:]):
                    paint_line(trails,p,q,120)
            plan=[(0,-9,'town-hall'),(-13,-5,'country-inn'),(13,-5,'market-stall'),
                  (-15,-14,'house-a'),(15,-14,'house-b'),(-15,7,'house-c'),(-7,7,'house-a'),
                  (7,7,'house-b'),(15,7,'house-a'),(-14,17,'farm-barn'),(14,17,'workshop'),
                  (-6,17,'house-b'),(6,17,'house-c'),(4,2,'village-well')]
            for row in (-3,9,19):
                paint_line(trails,(left+128,cy+row*64),(right-128,cy+row*64),120)
        else:
            specialty = 'farm-barn' if name in ('Blossom Crossroads','Greenbough Camp','Willowbank') else 'country-inn'
            plan=[(-5,-3,'house-a'),(5,-3,'house-b'),(-5,6,specialty),(5,6,'house-c'),(3,2,'village-well')]
            paint_line(trails,(left+128,cy+8*64),(right-128,cy+8*64),100)
        for dx,dy,sprite in plan:
            x,y=cx+dx*64,cy+dy*64
            if not wet[int(y//64),int(x//64)]:
                buildings.append((sprite,x,y))
                if sprite != 'village-well':
                    row = (-3 if dy < 0 else 9 if dy < 10 else 19) if major else (0 if dy < 0 else 8)
                    paint_line(trails,(x,y+24),(x,cy+row*64),100)
        yy,xx=np.mgrid[:h+1,:w+1]
        plaza=((xx*64-cx)/ (310 if major else 160))**2+((yy*64-cy)/(250 if major else 140))**2<1
        trails |= plaza & ~wet
        for x,y,direction in ((cx,top,'north'),(right,cy,'east'),(cx,bottom,'south'),(left,cy,'west')):
            gates.append(dict(village=name,x=x,y=y,direction=direction,width=256))
        for y in (top,bottom):
            # Overlap terminal posts, not the rails, to avoid breaks between modules.
            count=int(np.ceil((right-left)/240))
            for x in left+(np.arange(count)+0.5)*(right-left)/count:
                if abs(x-cx)<240:
                    continue
                fences.append(('fence-horizontal',float(x),y))
        for x in (left,right):
            count=int(np.ceil((bottom-top)/200))
            for y in top+(np.arange(count)+1)*(bottom-top)/count:
                if y > cy-128 and y-216 < cy+128:
                    continue
                fences.append(('fence-vertical',x,float(y)))
    # Add slanted field/country trails, in both diagonal directions; retain river crossings.
    routes=[[(14368,8000),(13088,6720),(13088,5408),(14368,4768)],
            [(12864,9344),(11264,10624),(9664,10624)],
            [(4256,7808),(5280,8832),(6688,8832)],
            [(7360,16320),(8960,14720),(10560,14720)],
            [(23072,6304),(21792,5024),(20448,5024)],
            [(22272,10720),(20992,9440),(19712,9440)]]
    for route in routes:
        for a,b in zip(route,route[1:]):
            paint_line(trails,a,b,120)
    # Existing cardinal roads and new diagonal routes share one editable corner-terrain layer.
    for dy,dx in ((0,0),(0,1),(1,0),(1,1)):
        trails[dy:dy+h,dx:dx+w] |= road
    trails &= ~wet
    masks=(trails[:-1,:-1].astype(int)+2*trails[:-1,1:]+4*trails[1:,:-1]+8*trails[1:,1:])
    return trails,masks,bounds,buildings,fences,gates,zones,len(routes)


def terrain_join_errors(gids, kit):
    lookup={tid+1:int(mask) for mask,tid in kit.items()}
    m=np.array([[lookup.get(int(g),0) for g in row] for row in gids])
    return int(np.count_nonzero(((m[:,:-1]&2)//2)!= (m[:,1:]&1))+
               np.count_nonzero(((m[:,:-1]&8)//8)!= ((m[:,1:]&4)//4))+
               np.count_nonzero(((m[:-1]&4)//4)!=(m[1:]&1))+
               np.count_nonzero(((m[:-1]&8)//8)!=((m[1:]&2)//2)))
