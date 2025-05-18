export default function JamLogo() {
  return (
    <div className="relative">
      <div className="w-12 h-12 rounded-full bg-jam-blue flex items-center justify-center text-white font-bold text-xl relative overflow-hidden shadow-md">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3)_0%,transparent_70%)]"></div>
        <span className="pixel-text relative z-10">J</span>
      </div>
      {/* Jam jar lid */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-8 h-2 bg-jam-orange rounded-t-md shadow-sm"></div>
      {/* Jam drip */}
      <div className="absolute -bottom-1 right-0 w-3 h-4 bg-jam-orange rounded-b-full"></div>
    </div>
  )
}
