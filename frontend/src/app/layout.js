import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata = {
  title: "StockSense AI - ML Quantitative Terminal",
  description: "Advanced Machine Learning Stock Prediction & Quantitative Intelligence Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0f1a] text-[#f1f5f9] antialiased selection:bg-[#10b981]/30 selection:text-[#10b981]">
        <div className="min-h-screen flex flex-col">
          {/* Fixed Left Sidebar & Mobile Navigation */}
          <Navigation />

          {/* Main Content Area */}
          <div className="flex-1 md:pl-64 flex flex-col pt-14 md:pt-0">
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {children}
            </main>

            {/* Bloomberg / Terminal Style Footer */}
            <footer className="border-t border-[#1e293b] bg-[#0a0f1a] py-4 px-6 text-center text-xs text-[#64748b] font-mono">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  <span>STOCKSENSE AI TERMINAL v1.0</span>
                </div>
                <div>Educational project. Not financial advice.</div>
                <div className="text-[11px] text-[#64748b]">
                  Data via Yahoo Finance • Powered by Next.js & FastAPI
                </div>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
