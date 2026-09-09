export type Photo = {
  id: string;
  src: string;
  title: string;
  note: string;
  date: string;
};

// 替换相册内容时，只需要维护这个列表和 public/photos 里的文件。
const placeholderScenes = [
  { src: '/photos/coast.png', title: '暮色海岸', note: '风把最后一束光留在了海面上。', date: '2026 · 海边' },
  { src: '/photos/rainy-city.png', title: '雨夜列车', note: '隔着车窗，城市变成一片柔软的光。', date: '2026 · 夜行' },
  { src: '/photos/moon-bike.png', title: '月下单车', note: '沿着河岸慢慢骑，等城市亮起灯。', date: '2026 · 初秋' },
];

// 先用三张示例图铺满 40 个球面位置；收到正式照片后，可直接逐项替换。
export const initialPhotos: Photo[] = Array.from({ length: 40 }, (_, index) => {
  const scene = placeholderScenes[index % placeholderScenes.length];
  return {
    ...scene,
    id: `placeholder-${index + 1}`,
    title: `${scene.title} ${String(Math.floor(index / 3) + 1).padStart(2, '0')}`,
  };
});
