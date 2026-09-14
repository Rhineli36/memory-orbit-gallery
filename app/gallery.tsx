'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Globe2, Grid3X3, Images, Maximize2, Orbit, Pause, Play, RotateCcw, Settings2, Upload, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { initialPhotos, type Photo } from './photos';

type SphereItem = Photo & { lat: number; lon: number };
type GalleryProps = { isOwner: boolean; initialGallery: Photo[] };

export default function Gallery({ isOwner, initialGallery }: GalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialGallery);
  const [selected, setSelected] = useState<number | null>(null);
  const [managing, setManaging] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [detailsVisible, setDetailsVisible] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'orderly' | 'classic' | 'scatter'>('orderly');
  const [storageReady, setStorageReady] = useState(!isOwner);
  const [storageState, setStorageState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>(isOwner ? 'loading' : 'ready');
  const lastSavedPhotos = useRef(JSON.stringify(initialGallery));
  const sphereRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, selectedIndex: -1, x: 0, y: 0, rx: -7, ry: -11, vx: 0, vy: 0 });

  const items = useMemo<SphereItem[]>(() => {
    const count = photos.length;
    if (layoutMode === 'classic') {
      const rings = [
        { count: 6, lat: -52, offset: 14 },
        { count: 8, lat: -26, offset: 0 },
        { count: 8, lat: 0, offset: 24 },
        { count: 8, lat: 26, offset: 5 },
        { count: 6, lat: 52, offset: 28 },
      ];
      return photos.slice(0, 36).map((photo, index) => {
        let start = 0;
        const ring = rings.find((entry) => {
          if (index < start + entry.count) return true;
          start += entry.count;
          return false;
        }) ?? rings[rings.length - 1];
        const column = index - start;
        return { ...photo, lat: ring.lat, lon: (column * (360 / ring.count) + ring.offset) % 360 };
      });
    }
    return photos.map((photo, index) => {
      const gridded = layoutMode === 'orderly';
      const columns = 8;
      const row = Math.floor(index / columns);
      const column = index % columns;
      const rows = Math.ceil(count / columns);
      const y = 1 - ((index + 0.5) / count) * 2;
      const lat = gridded ? -48 + row * (96 / Math.max(1, rows - 1)) : Math.asin(y) * (180 / Math.PI);
      const lon = gridded ? (column * 45 + (row % 2 ? 22.5 : 0)) % 360 : (index * 137.508) % 360;
      return { ...photo, lat, lon };
    });
  }, [photos, layoutMode]);

  const transitionTo = (update: () => void) => {
    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    if (transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(() => flushSync(update));
    } else {
      update();
    }
  };

  const openPhoto = (index: number) => transitionTo(() => setSelected(index));
  const closePhoto = () => transitionTo(() => setSelected(null));
  const closeFromMediaGutter = (event: MouseEvent<HTMLDivElement>) => {
    const image = event.currentTarget.querySelector<HTMLImageElement>('.lightbox-photo');
    if (!image?.naturalWidth || !image.naturalHeight) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const displayedWidth = image.naturalWidth * scale;
    const displayedHeight = image.naturalHeight * scale;
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const imageLeft = (bounds.width - displayedWidth) / 2;
    const imageTop = (bounds.height - displayedHeight) / 2;
    const clickedImage = x >= imageLeft && x <= imageLeft + displayedWidth && y >= imageTop && y <= imageTop + displayedHeight;

    if (!clickedImage) closePhoto();
  };

  const savePhotos = async (nextPhotos: Photo[]) => {
    setStorageState('saving');
    try {
      const response = await fetch('/api/memories', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ photos: nextPhotos }),
      });
      if (!response.ok) throw new Error('save failed');
      lastSavedPhotos.current = JSON.stringify(nextPhotos);
      setStorageState('saved');
    } catch {
      setStorageState('error');
    }
  };

  useEffect(() => {
    if (!isOwner) return;
    const controller = new AbortController();
    setStorageState('loading');

    fetch('/api/recover', { method: 'POST', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('recover failed');
        return response.json() as Promise<{ photos?: Photo[] }>;
      })
      .then((data) => {
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          setPhotos(data.photos);
          lastSavedPhotos.current = JSON.stringify(data.photos);
          setStorageState('saved');
        } else {
          setStorageState('ready');
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error('gallery recovery request failed', error);
          setStorageState('error');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setStorageReady(true);
      });

    return () => controller.abort();
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner || !storageReady) return;
    if (JSON.stringify(photos) === lastSavedPhotos.current) return;
    const timer = window.setTimeout(() => {
      void savePhotos(photos);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [photos, isOwner, storageReady]);

  useEffect(() => {
    if (selected === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePhoto();
      if (event.key === 'ArrowLeft') showPrevious();
      if (event.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const d = drag.current;
      if (!d.active) {
        d.ry += playing ? 0.085 + d.vx : d.vx;
        d.rx = Math.max(-48, Math.min(48, d.rx + d.vy));
        d.vx *= 0.94;
        d.vy *= 0.94;
      }
      if (sphereRef.current) sphereRef.current.style.transform = `rotateX(${d.rx}deg) rotateY(${d.ry}deg)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const context = (document as Document & {
      modelContext?: {
        registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
      };
    }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    void Promise.resolve(context.registerTool({
      name: 'set_gallery_autoplay',
      title: '设置相册自动旋转',
      description: '开启或暂停当前 3D 球面相册的自动旋转。',
      inputSchema: {
        type: 'object',
        properties: { playing: { type: 'boolean' } },
        required: ['playing'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        if (!input || typeof input !== 'object' || typeof (input as { playing?: unknown }).playing !== 'boolean') {
          throw new Error('playing 必须是布尔值');
        }
        const next = (input as { playing: boolean }).playing;
        setPlaying(next);
        return { playing: next };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);

    return () => lifecycle.abort();
  }, []);

  const movePhoto = (index: number, direction: -1 | 1) => {
    setPhotos((current) => {
      const next = [...current];
      const target = (index + direction + next.length) % next.length;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setStorageState('saving');
    try {
      const additions: Photo[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch('/api/upload', { method: 'POST', body: form });
        if (!response.ok) throw new Error('upload failed');
        const data = await response.json() as { photo: Photo };
        additions.push(data.photo);
      }
      setPhotos((current) => {
        const retained = current.some((photo) => photo.src.startsWith('/api/photo/')) ? current : [];
        return [...retained, ...additions];
      });
    } catch {
      setStorageState('error');
    }
  };

  const showPrevious = () => selected !== null && setSelected((selected - 1 + photos.length) % photos.length);
  const showNext = () => selected !== null && setSelected((selected + 1) % photos.length);
  const updateSelectedPhoto = (patch: Partial<Photo>) => {
    if (selected === null) return;
    setPhotos((current) => current.map((photo, index) => index === selected ? { ...photo, ...patch } : photo));
  };

  return (
    <main className={`album-shell ${selected !== null ? 'lightbox-active' : ''}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a className="brand" href="#gallery" aria-label="回到相册">
          <span className="brand-mark"><Images size={18} /></span>
          <span><strong>光影轨迹</strong><small>MEMORY ORBIT</small></span>
        </a>
        <div className="header-actions">
          <div className="layout-switch" aria-label="球面排列方式">
            <button className={layoutMode === 'orderly' ? 'active' : ''} onClick={() => setLayoutMode('orderly')} aria-pressed={layoutMode === 'orderly'}><Grid3X3 size={14} /> 横排</button>
            <button className={layoutMode === 'classic' ? 'active' : ''} onClick={() => setLayoutMode('classic')} aria-pressed={layoutMode === 'classic'}><Globe2 size={14} /> 经典</button>
            <button className={layoutMode === 'scatter' ? 'active' : ''} onClick={() => setLayoutMode('scatter')} aria-pressed={layoutMode === 'scatter'}><Orbit size={15} /> 星群</button>
          </div>
          <button className={`autoplay-toggle ${playing ? 'is-playing' : ''}`} onClick={() => setPlaying(!playing)} aria-label={playing ? '关闭自动旋转' : '开启自动旋转'} aria-pressed={playing}>
            {playing ? <Pause size={15} /> : <Play size={15} />}<span>自动旋转</span><b>{playing ? '开' : '关'}</b>
          </button>
          {isOwner && <button className="manage-button" onClick={() => setManaging(true)}><Settings2 size={17} /> 管理照片</button>}
        </div>
      </header>

      <section id="gallery" className="gallery-stage" aria-label="3D 球面相册">
        <div className="intro">
          <p className="eyebrow"><span /> 私人影像收藏</p>
          <h1>让记忆，<em>沿轨迹流动</em></h1>
          <p>拖动探索影像星球，滚轮也能改变方向。<br />轻点任意照片，进入全屏细节。</p>
        </div>

        <div
          className="sphere-viewport"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const target = event.target as HTMLElement;
            const photoButton = target.closest<HTMLElement>('[data-photo-index]');
            Object.assign(drag.current, { active: true, moved: false, selectedIndex: photoButton ? Number(photoButton.dataset.photoIndex) : -1, x: event.clientX, y: event.clientY, vx: 0, vy: 0 });
          }}
          onPointerMove={(event) => {
            const d = drag.current;
            if (!d.active) return;
            const dx = event.clientX - d.x;
            const dy = event.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
            d.ry += dx * 0.18;
            d.rx = Math.max(-48, Math.min(48, d.rx - dy * 0.14));
            d.vx = dx * 0.018;
            d.vy = -dy * 0.012;
            d.x = event.clientX;
            d.y = event.clientY;
          }}
          onPointerUp={() => {
            const d = drag.current;
            d.active = false;
            if (!d.moved && d.selectedIndex >= 0) openPhoto(d.selectedIndex);
            d.selectedIndex = -1;
          }}
          onPointerCancel={() => { drag.current.active = false; drag.current.selectedIndex = -1; }}
          onWheel={(event) => { drag.current.ry += event.deltaY * 0.045; }}
        >
          <div className="orbit-ring orbit-ring-a" />
          <div className="orbit-ring orbit-ring-b" />
          <div ref={sphereRef} className="photo-sphere">
            {items.map((photo, index) => (
              <button
                key={photo.id}
                data-photo-index={index}
                className="sphere-photo"
                style={{ '--lat': `${photo.lat}deg`, '--lon': `${photo.lon}deg` } as CSSProperties}
                onClick={(event) => { if (event.detail === 0) openPhoto(index); }}
                aria-label={`查看 ${photo.title}`}
              >
                <img src={photo.src} alt={photo.title} draggable={false} style={{ viewTransitionName: selected === index ? 'none' : `photo-${index}` }} />
                <span><Maximize2 size={14} /></span>
              </button>
            ))}
          </div>
          <div className={`sphere-core core-${layoutMode}`} aria-hidden="true">
            <div className="nebula">
              <i className="nebula-cloud cloud-a" />
              <i className="nebula-cloud cloud-b" />
              <i className="nebula-cloud cloud-c" />
              <i className="nebula-star star-a" />
              <i className="nebula-star star-b" />
              <i className="nebula-star star-c" />
              <i className="particle-field particles-near" />
              <i className="particle-field particles-far" />
            </div>
          </div>
        </div>

        <div className="drag-hint"><span className="mouse-icon" /> 拖动球面 · 滚轮漫游</div>
      </section>

      {isOwner && <aside className={`manager ${managing ? 'manager-open' : ''}`} aria-hidden={!managing}>
        <div className="manager-head">
          <div><p className="eyebrow">COLLECTION</p><h2>照片管理</h2></div>
          <button className="icon-button" onClick={() => setManaging(false)} aria-label="关闭照片管理"><X size={19} /></button>
        </div>
        <p className="manager-copy">上传、排序或移除照片，修改会自动保存到云端。</p>
        <p className={`storage-status storage-${storageState}`} aria-live="polite">{storageState === 'saving' ? '正在保存…' : storageState === 'error' ? '保存失败，请重试' : storageState === 'loading' ? '正在读取…' : '已同步'}</p>
        <button className="save-button" onClick={() => void savePhotos(photos)} disabled={storageState === 'saving'}>{storageState === 'saving' ? '正在保存…' : storageState === 'error' ? '重新保存' : '立即保存'}</button>
        <label className="upload-button"><Upload size={18} /> 添加照片<input type="file" accept="image/*" multiple onChange={(event) => { void onUpload(event.target.files); event.currentTarget.value = ''; }} /></label>
        <div className="photo-list">
          {photos.map((photo, index) => (
            <article className="photo-row" key={photo.id}>
              <img src={photo.src} alt="" />
              <div><strong>{photo.title}</strong><small>{String(index + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</small></div>
              <div className="row-actions">
                <button onClick={() => movePhoto(index, -1)} aria-label="向前移动"><ChevronLeft size={16} /></button>
                <button onClick={() => movePhoto(index, 1)} aria-label="向后移动"><ChevronRight size={16} /></button>
                <button onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))} aria-label="移除照片"><X size={16} /></button>
              </div>
            </article>
          ))}
        </div>
        <button className="reset-button" onClick={() => setPhotos(initialPhotos)}><RotateCcw size={15} /> 恢复示例照片</button>
      </aside>}
      {isOwner && managing && <button className="manager-scrim" onClick={() => setManaging(false)} aria-label="关闭照片管理" />}

      {selected !== null && photos[selected] && createPortal(
        <div className="lightbox" role="dialog" aria-modal="true" aria-labelledby="lightbox-title" aria-describedby="lightbox-note">
            <>
              <h2 id="lightbox-title" className="sr-only">{photos[selected].title}</h2>
              <p id="lightbox-note" className="sr-only">{photos[selected].note}</p>
              <div
                className={`lightbox-media ${detailsVisible ? 'media-with-details' : ''}`}
                role="img"
                aria-label={photos[selected].title}
                style={{ viewTransitionName: `photo-${selected}` }}
                onClick={closeFromMediaGutter}
              >
                <div className="lightbox-backdrop" style={{ backgroundImage: `url("${photos[selected].src}")` }} />
                <img className="lightbox-photo" src={photos[selected].src} alt="" aria-hidden="true" draggable={false} />
              </div>
              <div className="lightbox-toolbar">
                <button className="back-to-sphere" onClick={closePhoto}><ArrowLeft size={18} /> 返回球面</button>
                <label className="details-toggle">
                  <span>{detailsVisible ? '隐藏文字' : '显示文字'}</span>
                  <Switch checked={detailsVisible} onCheckedChange={setDetailsVisible} aria-label="显示或隐藏文字栏" />
                </label>
              </div>
              <button className="lightbox-nav lightbox-prev" onClick={showPrevious} aria-label="上一张"><ChevronLeft size={30} /></button>
              <button className={`lightbox-nav lightbox-next ${detailsVisible ? 'nav-with-details' : ''}`} onClick={showNext} aria-label="下一张"><ChevronRight size={30} /></button>
              {detailsVisible && (
                <aside className="lightbox-details">
                  <div className="details-heading">
                    <span>{String(selected + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</span>
                    <h2>{photos[selected].title}</h2>
                  </div>
                  <label><span>时间</span><input value={photos[selected].date} readOnly={!isOwner} onChange={isOwner ? (event) => updateSelectedPhoto({ date: event.target.value }) : undefined} /></label>
                  <label><span>当时的事情</span><textarea rows={2} value={photos[selected].story} readOnly={!isOwner} placeholder="记录当时发生的事情…" onChange={isOwner ? (event) => updateSelectedPhoto({ story: event.target.value }) : undefined} /></label>
                  <label><span>感想</span><textarea rows={2} value={photos[selected].note} readOnly={!isOwner} placeholder="写下这一刻的感受…" onChange={isOwner ? (event) => updateSelectedPhoto({ note: event.target.value }) : undefined} /></label>
                </aside>
              )}
            </>
        </div>,
        document.body,
      )}
    </main>
  );
}
