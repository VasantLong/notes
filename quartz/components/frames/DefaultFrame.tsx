import { PageFrame, PageFrameProps } from "./types"
import HeaderConstructor from "../Header"
import UiLang from "../UiLang"
import SiteFooter from "../SiteFooter"

const Header = HeaderConstructor()
const UiLangSwitch = UiLang()
const Footer = SiteFooter()

/**
 * The default page frame — three-column layout with left sidebar, center
 * content (header + body + afterBody), and right sidebar, followed by a footer.
 *
 * This is the original Quartz layout, extracted from renderPage.tsx.
 */
export const DefaultFrame: PageFrame = {
  name: "default",
  render({
    componentData,
    header,
    beforeBody,
    pageBody: Content,
    afterBody,
    left,
    right,
    sidebars,
  }: PageFrameProps) {
    return (
      <>
        <div class="left sidebar" data-sidebar-mode={sidebars?.left ?? "fit"}>
          {left.map((BodyComponent) => (
            <BodyComponent {...componentData} />
          ))}
        </div>
        <div class="center">
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
        <div class="right sidebar" data-sidebar-mode={sidebars?.right ?? "fit"}>
          {right.map((BodyComponent) => (
            <BodyComponent {...componentData} />
          ))}
        </div>
        <Footer {...componentData} />
      </>
    )
  },
}
