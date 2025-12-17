import { Link } from "@heroui/link";

import { Navbar } from "@/components/navbar";

export default function DefaultLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative flex flex-col h-screen">
            <Navbar />
            <main className="container mx-auto max-w-9xl px-0 md:px-6 flex-grow pt-0 md:pt-16">{children}</main>
            <footer className="w-full items-center justify-center py-3 hidden md:flex">
                <Link isExternal className="flex items-center gap-1 text-current" href="https://heroui.com" title="heroui.com homepage">
                    <span className="text-default-600">Powered by</span>
                    <p className="text-primary">HeroUI</p>
                </Link>
                <span className="text-default-600 ml-9">Made with ❤️ by GY.</span>
            </footer>
        </div>
    );
}
