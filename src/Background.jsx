// Kinukuha lahat ng photo sa img/ folder (kahit ilan, automatic)
const modules = import.meta.glob('../img/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const IMAGES = Object.entries(modules)
  .filter(([path]) => !path.endsWith('/handheart.jpg'))
  .map(([, image]) => image)
const COLUMNS = 4

function buildColumn(offset) {
  const shift = offset % IMAGES.length
  const rotated = [...IMAGES.slice(shift), ...IMAGES.slice(0, shift)]
  const set = []
  while (set.length < 6) set.push(...rotated)
  return [...set, ...set]
}

// soft = calmer and darker, used behind the in-app screens (Chat, Memories, Streak)
export default function Background({ soft = false }) {
  if (IMAGES.length === 0) {
    return <div className="fixed inset-0 -z-10 bg-[#0e0e10]" aria-hidden="true" />
  }

  const columns = Array.from({ length: COLUMNS }, (_, index) => buildColumn(index))

  return (
    <div className="fixed inset-0 -z-10 bg-[#0e0e10] overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 flex gap-2 px-2">
        {columns.map((list, index) => (
          <div key={index} className="flex-1 overflow-hidden">
            <div
              className={`flex flex-col will-change-transform ${
                index % 2 === 0 ? 'scroll-up' : 'scroll-down'
              }`}
              style={{ animationDuration: `${(soft ? 70 : 45) + index * 12}s` }}
            >
              {list.map((src, imageIndex) => (
                <img
                  key={imageIndex}
                  src={src}
                  alt=""
                  className="w-full aspect-[3/4] object-cover rounded-2xl mb-2"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={`absolute inset-0 ${soft ? 'bg-[#0e0e10]/75' : 'bg-[#0e0e10]/65'}`} />
    </div>
  )
}