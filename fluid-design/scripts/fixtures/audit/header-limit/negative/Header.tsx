// <header className="fluid-grow-until-1680"> in a comment is not a hit
export function Header() {
  return (
    <>
      <header data-note="fluid-grow-until-1680" className="sticky top-0 fluid-ui-p-24">
        <nav />
      </header>
      <section className="fluid-grow-until-1680" />
    </>
  )
}
