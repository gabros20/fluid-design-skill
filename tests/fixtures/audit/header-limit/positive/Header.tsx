export function Header() {
  return (
    <header onClick={() => setOpen((o) => o > 1)} data-x="a=>b" className="sticky top-0 lg:fluid-ui-grow-until-1680">
      <nav />
    </header>
  )
}
