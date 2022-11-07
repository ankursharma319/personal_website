import MyErrorPage from "../components/error_page"

export default function Page404() {
    return <MyErrorPage error_code={404} description={"This page could not be found"}/>
}
