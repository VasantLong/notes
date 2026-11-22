import { PageFrame, PageFrameProps } from "./types"
import HeaderConstructor from "../Header"
import UiLang from "../UiLang"
import SiteFooter from "../SiteFooter"

const Header = HeaderConstructor()
const UiLangSwitch = UiLang()
const Footer = SiteFooter()

/**
 * Full-width page frame — no sidebars. The center content area spans the
 * full width of the page. Header, beforeBody, body, afterBody, and footer
 * are all rendered in a single column.
 *
 * Useful for page types like Canvas, presentations, or dashboards that
 * need maximum horizontal space.
 */
export const FullWidthFrame: PageFrame = {
  name: "full-width",
  render({ componentData, header, beforeBody, pageBody: Content, afterBody }: PageFrameProps) {
    return (
      <>
        <div class="center full-width">
          <div class="page-header">
            <Header {...componentData}>
              {[
                ...header.map((HeaderComponent) => <HeaderComponent {...componentData} />),
                <UiLangSwitch {...componentData} />,
              ]}
            </Header>
            <div class="popover-hint">
              {beforeBody.map((BodyComponent) => (
                <BodyComponent {...componentData} />
              ))}
            </div>
          </div>
          <Content {...componentData} />
          <hr />
          <div class="page-footer">
            {afterBody.map((BodyComponent) => (
              <BodyComponent {...componentData} />
            ))}
          </div>
        </div>
        <Footer {...componentData} />
      </>
    )
  },
}
