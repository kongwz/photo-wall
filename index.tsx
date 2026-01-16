// 警告：在 GitHub Pages 这种“零构建”模式下，绝对不能写 import 语句
// 修正：当前环境已识别为模块，必须添加导入语句以解决 UMD 全局变量引用错误
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

const RATIOS: Record<string, number> = { 
    '3:2 (全幅)': 1.5, 
    '4:3 (标准)': 1.333, 
    '1:1 (方构图)': 1, 
    '16:9 (屏显)': 1.777, 
    '21:9 (宽幅)': 2.333,
    '3:4 (人像)': 0.75,
    '2:3 (书画)': 0.666,
    '9:16 (手机)': 0.5625
};

const RESOLUTIONS: Record<string, number> = { 
    '1080p': 1920, 
    '2K': 2560, 
    '4K': 3840, 
    '5K': 5120 
};

interface Photo {
    img: HTMLImageElement;
    ratio: number;
    url: string;
}

const Slider = ({ label, min, max, value, unit, step = 1, isPercent = false, onChange }: any) => (
    <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
            <span>{label}</span>
            <span className="text-blue-500 font-mono">{isPercent ? Math.round(value * 100) : value}{unit}</span>
        </div>
        <input 
            type="range" 
            min={min} 
            max={max} 
            step={step} 
            value={value} 
            onChange={e => onChange(parseFloat(e.target.value))} 
            className="w-full"
        />
    </div>
);

const App = () => {
    // 修正：添加 Photo 接口以获得更好的类型支持
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [settings, setSettings] = useState({
        mode: 'fixedWidth',
        size: 300,
        gap: 12,
        tilt: -12,
        ratio: '3:2 (全幅)',
        res: '1080p',
        bg: '#000000',
        zoom: 0.4,
        invertedRatio: false
    });
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [seed, setSeed] = useState(Math.random());
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleClear = () => {
        if (!confirm('确定清空所有照片吗？')) return;
        photos.forEach(p => URL.revokeObjectURL(p.url));
        setPhotos([]);
        setOffset({ x: 0, y: 0 });
        setSeed(Math.random());
    };

    const handleRandomize = () => {
        if (photos.length === 0) return;
        setPhotos(prev => [...prev].sort(() => Math.random() - 0.5));
        setSeed(Math.random());
    };

    // 修正：为 e 添加 React.ChangeEvent<HTMLInputElement> 类型，并显式指定 Promise 的返回类型
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const newPhotos = await Promise.all(files.map((file: File) => new Promise<Photo>(res => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => res({ img, ratio: img.width / img.height, url });
            img.src = url;
        })));
        setPhotos((prev) => [...prev, ...newPhotos]);
        e.target.value = '';
    };

    const canvasDims = useMemo(() => {
        const baseSize = RESOLUTIONS[settings.res as keyof typeof RESOLUTIONS] || 1920;
        let r = RATIOS[settings.ratio as keyof typeof RATIOS] || 1.5;
        if (settings.invertedRatio) r = 1 / r;

        let w, h;
        if (r >= 1) {
            w = baseSize;
            h = baseSize / r;
        } else {
            h = baseSize;
            w = baseSize * r;
        }
        return { w: Math.round(w), h: Math.round(h) };
    }, [settings.res, settings.ratio, settings.invertedRatio]);

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const { w, h } = canvasDims;
        canvas.width = w; 
        canvas.height = h;

        ctx.fillStyle = settings.bg;
        ctx.fillRect(0, 0, w, h);

        if (photos.length === 0) return;

        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(settings.tilt * Math.PI / 180);
        ctx.translate(offset.x, offset.y);

        const { mode, size, gap } = settings;
        const pseudoRandom = (i: number) => {
            const x = Math.sin(i * 12.9898 + seed * 43758.5453) * 43758.5453;
            return x - Math.floor(x);
        };

        const limit = 40; 

        if (mode === 'fixedHeight') {
            for (let r = -limit; r < limit; r++) {
                const y = r * (size + gap);
                let x = -w * 4 + pseudoRandom(r) * w;
                let idx = Math.abs(Math.floor(pseudoRandom(r * 2) * photos.length));
                while (x < w * 4) {
                    const p = photos[idx % photos.length];
                    if (!p) break;
                    const dw = size * p.ratio;
                    ctx.drawImage(p.img, x, y, dw, size);
                    x += dw + gap;
                    idx = (idx + 1) % photos.length;
                }
            }
        } else {
            for (let c = -limit; c < limit; c++) {
                const x = c * (size + gap);
                let y = -h * 4 + pseudoRandom(c) * h;
                let idx = Math.abs(Math.floor(pseudoRandom(c * 3) * photos.length));
                while (y < h * 4) {
                    const p = photos[idx % photos.length];
                    if (!p) break;
                    const draw_dh = size / p.ratio;
                    ctx.drawImage(p.img, x, y, size, draw_dh);
                    y += draw_dh + gap;
                    idx = (idx + 7) % photos.length;
                }
            }
        }
        ctx.restore();

        const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.9);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }, [photos, settings, offset, canvasDims, seed]);

    useEffect(() => { render(); }, [render]);

    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = (e.clientX - dragStart.current.x) / settings.zoom;
        const dy = (e.clientY - dragStart.current.y) / settings.zoom;
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        dragStart.current = { x: e.clientX, y: e.clientY };
    };

    const exportCanvas = () => {
        const link = document.createElement('a');
        link.download = `Gallery_by_Kelo_${Date.now()}.jpg`;
        link.href = canvasRef.current?.toDataURL('image/jpeg', 0.92) || '';
        link.click();
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden select-none bg-[#050505]">
            <aside className="sidebar w-80 h-full p-6 flex flex-col z-50 shadow-2xl">
                <div className="mb-10">
                    <h1 className="text-2xl font-black tracking-tighter text-blue-500 italic">CINEMATIC Pro</h1>
                    <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em]">BY KELO</p>
                </div>

                <div className="space-y-8 flex-1 overflow-y-auto pr-2 custom-scroll">
                    <section>
                        <span className="control-group-title">1. 资源管理</span>
                        <input type="file" multiple id="upload" className="hidden" onChange={handleUpload} accept="image/*" />
                        <label htmlFor="upload" className="btn-hover flex items-center justify-center w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl cursor-pointer text-sm font-bold gap-3 mb-3 shadow-lg shadow-blue-900/20">
                            <i className="fas fa-plus-circle"></i> 导入作品 ({photos.length})
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleRandomize} disabled={!photos.length} className="btn-hover py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold rounded-xl uppercase tracking-wider">
                                <i className="fas fa-random mr-2 text-blue-400"></i> 随机乱序
                            </button>
                            <button onClick={handleClear} disabled={!photos.length} className="btn-hover py-3 bg-zinc-800 hover:bg-red-900/20 hover:text-red-400 text-zinc-300 text-[11px] font-bold rounded-xl uppercase tracking-wider">
                                <i className="fas fa-trash-alt mr-2"></i> 清空
                            </button>
                        </div>
                    </section>

                    <section className="space-y-5">
                        <span className="control-group-title">2. 画布核心</span>
                        <div className="space-y-2">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase">排列逻辑</span>
                            <select value={settings.mode} onChange={e => setSettings(s => ({...s, mode: e.target.value}))} className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-xs outline-none text-zinc-200">
                                <option value="fixedHeight">🎞️ 水平拼接</option>
                                <option value="fixedWidth">🌊 纵向瀑布</option>
                            </select>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">比例/方向</span>
                                <button 
                                    onClick={() => setSettings(s => ({...s, invertedRatio: !s.invertedRatio}))}
                                    className={`text-[10px] px-2 py-1 rounded transition-colors ${settings.invertedRatio ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                                >
                                    <i className="fas fa-sync mr-1"></i> 横竖反转
                                </button>
                            </div>
                            <select value={settings.ratio} onChange={e => setSettings(s => ({...s, ratio: e.target.value}))} className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-xs outline-none text-zinc-200">
                                {Object.keys(RATIOS).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">底色</span>
                                <div className="color-input-wrapper">
                                    <input type="color" value={settings.bg} onChange={e => setSettings(s => ({...s, bg: e.target.value}))} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">尺寸</span>
                                <select value={settings.res} onChange={e => setSettings(s => ({...s, res: e.target.value}))} className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-xs outline-none">
                                    {Object.keys(RESOLUTIONS).map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-5">
                        <span className="control-group-title">3. 视觉微调</span>
                        <Slider label="倾斜角度" min={-45} max={45} value={settings.tilt} unit="°" onChange={(v: number) => setSettings(s => ({...s, tilt: v}))} />
                        <Slider label="图片比例" min={100} max={800} value={settings.size} unit="px" onChange={(v: number) => setSettings(s => ({...s, size: v}))} />
                        <Slider label="间距" min={0} max={60} value={settings.gap} unit="px" onChange={(v: number) => setSettings(s => ({...s, gap: v}))} />
                        <Slider label="预览缩放" min={0.05} max={2.0} step={0.05} value={settings.zoom} unit="%" isPercent onChange={(v: number) => setSettings(s => ({...s, zoom: v}))} />
                    </section>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 space-y-5">
                    <div className="text-center">
                        <span className="text-[9px] text-zinc-600 font-black tracking-widest block mb-1 uppercase">制作人</span>
                        <p className="text-lg text-zinc-100 font-bold tracking-[0.3em] signature-font">Kelo</p>
                    </div>
                    <button onClick={exportCanvas} disabled={!photos.length} className="btn-hover w-full py-4 bg-white hover:bg-zinc-200 text-black font-black text-xs rounded-2xl shadow-2xl disabled:bg-zinc-800 disabled:text-zinc-600 uppercase tracking-[0.2em]">
                        <i className="fas fa-download mr-2"></i> 保存高清图片
                    </button>
                </div>
            </aside>

            <main 
                className="flex-1 canvas-viewport relative" 
                onMouseDown={onMouseDown} 
                onMouseMove={onMouseMove} 
                onMouseUp={() => setIsDragging(false)} 
                onMouseLeave={() => setIsDragging(false)}
            >
                <div style={{ transform: `scale(${settings.zoom})`, transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)' }}>
                    <canvas ref={canvasRef} className="rounded-sm" />
                </div>
                
                <div className="absolute bottom-8 left-8 flex items-center gap-6 px-6 py-3 bg-black/70 backdrop-blur-xl rounded-2xl border border-white/5 text-[10px] font-mono tracking-widest text-zinc-400 uppercase shadow-2xl">
                    <span className="flex items-center gap-2"><i className="fas fa-expand-arrows-alt text-blue-500"></i> {canvasDims.w} x {canvasDims.h} PX</span>
                    <div className="w-[1px] h-3 bg-white/10"></div>
                    <span className="flex items-center gap-2"><i className="fas fa-signature text-blue-500"></i> PRODUCED BY KELO</span>
                </div>

                {photos.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-zinc-800">
                        <i className="fas fa-camera-retro text-9xl mb-6 opacity-20"></i>
                        <h3 className="font-black text-2xl uppercase tracking-[0.5em] opacity-30">Gallery Empty</h3>
                        <p className="text-xs tracking-widest mt-2 opacity-30">上传你的摄影摄影作品，开始艺术拼接</p>
                    </div>
                )}
            </main>
        </div>
    );
};

// 修正：确保在全局环境下通过 ReactDOM 变量初始化，并使用 React 18 的 createRoot API (从 react-dom/client 导入)
const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
}