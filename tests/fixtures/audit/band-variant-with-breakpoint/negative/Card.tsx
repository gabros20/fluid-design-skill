export function Card() {
  return (
    <>
      <div className="fluid-tablet:p-4 md:gap-8 hover:md:p-2" />
      <div className="fluid-phone:hidden" />
      <div className="md:max-lg:p-4 lg:fluid-p-24" />
      {/* lg:/xl: start at the desktop band, where band variants never match */}
      <div className="hidden fluid-tablet:block lg:block xl:hidden" />
    </>
  )
}
