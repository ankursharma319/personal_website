import Head from 'next/head'
import Image from 'next/image'
import MainLayout from '../components/main_layout'

export default function Home(props: any) {
  return (
    <MainLayout setTheme={props.setTheme}>
      Hello world!
    </MainLayout>
  )
}
