"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const PAGE_SIZE = 20;

interface Product {
  stacklineSku: string;
  title: string;
  categoryName: string;
  subCategoryName: string;
  imageUrls: string[];
  retailPrice?: number;
}

const ALL_OPTION = "__all__";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => searchParams.get("category") ?? ""
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(
    () => searchParams.get("subCategory") ?? ""
  );
  const [loading, setLoading] = useState(true);
  const [filterKey, setFilterKey] = useState(0);
  const [page, setPage] = useState(
    () => parseInt(searchParams.get("page") ?? "1", 10) || 1
  );
  const [totalProducts, setTotalProducts] = useState(0);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
    setSelectedCategory(searchParams.get("category") ?? "");
    setSelectedSubCategory(searchParams.get("subCategory") ?? "");
    const urlPage = parseInt(searchParams.get("page") ?? "1", 10);
    setPage(urlPage >= 1 ? urlPage : 1);
  }, [searchParams]);

  useEffect(() => {
    setSelectedSubCategory("");
    if (selectedCategory) {
      fetch(`/api/subcategories?category=${encodeURIComponent(selectedCategory)}`)
        .then((res) => res.json())
        .then((data) => setSubCategories(data.subCategories));
    } else {
      setSubCategories([]);
    }
  }, [selectedCategory]);

  const maxPage = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const safePageNum = Number.isFinite(page) && page >= 1 ? page : 1;
  const safePage =
    totalProducts > 0
      ? Math.min(Math.max(1, safePageNum), maxPage)
      : safePageNum;
  const pageForUrl = totalProducts > 0 ? safePage : safePageNum;

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    const max = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
    const pageToUse = totalProducts > 0 ? Math.min(Math.max(1, page), max) : Math.max(1, page);
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (selectedCategory) params.append("category", selectedCategory);
    if (selectedSubCategory) params.append("subCategory", selectedSubCategory);
    params.append("limit", String(PAGE_SIZE));
    params.append("offset", String((pageToUse - 1) * PAGE_SIZE));

    fetch(`/api/products?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setProducts(Array.isArray(data?.products) ? data.products : []);
        setTotalProducts(typeof data?.total === "number" ? data.total : 0);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setLoading(false);
      });

    return () => controller.abort();
  }, [search, selectedCategory, selectedSubCategory, page]);

  useEffect(() => {
    if (totalProducts > 0) {
      const max = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
      if (page > max) setPage(max);
    }
  }, [totalProducts, page]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (selectedCategory) params.set("category", selectedCategory);
    if (selectedSubCategory) params.set("subCategory", selectedSubCategory);
    if (pageForUrl > 1) params.set("page", String(pageForUrl));
    const query = params.toString();
    const newSearch = query ? `?${query}` : "";
    const currentSearch = typeof window !== "undefined" ? window.location.search : "";
    if (newSearch !== currentSearch) {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [search, selectedCategory, selectedSubCategory, page, pageForUrl, pathname, router]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold mb-6">StackShop</h1>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>

            <div key={`filters-${filterKey}`} className="flex flex-col md:flex-row gap-4 flex-1 md:flex-initial">
              <Select
                value={selectedCategory || ALL_OPTION}
                onValueChange={(v) => {
                  const newCategory = v === ALL_OPTION ? "" : v;
                  setSelectedCategory(newCategory);
                  setSelectedSubCategory("");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_OPTION}>All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCategory && subCategories.length > 0 && (
                <Select
                  value={selectedSubCategory || ALL_OPTION}
                  onValueChange={(v) => {
                    setSelectedSubCategory(v === ALL_OPTION ? "" : v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="All Subcategories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_OPTION}>All Subcategories</SelectItem>
                    {subCategories.map((subCat) => (
                      <SelectItem key={subCat} value={subCat}>
                        {subCat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(selectedCategory || selectedSubCategory) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCategory("");
                    setSelectedSubCategory("");
                    setFilterKey((k) => k + 1);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No products found</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <p className="text-sm text-muted-foreground">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, totalProducts)} of {totalProducts}{" "}
                products
              </p>
              {totalProducts > PAGE_SIZE && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {safePage} of {maxPage}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p: number) =>
                        Math.min(Math.max(1, Math.ceil(totalProducts / PAGE_SIZE)), p + 1)
                      )
                    }
                    disabled={safePage >= maxPage}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(products ?? []).map((product) => (
                <Link
                  key={product.stacklineSku}
                  href={`/product?sku=${encodeURIComponent(product.stacklineSku)}`}
                >
                  <Card className="h-full flex flex-col cursor-pointer transition-all duration-200 hover:shadow-xl hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:-translate-y-1">
                    <CardHeader className="p-0 shrink-0">
                      <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-muted">
                        {product.imageUrls?.[0] && (
                          <Image
                            src={product.imageUrls[0]}
                            alt={product.title}
                            fill
                            className="object-contain p-4"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 flex-1 min-h-0">
                      <CardTitle className="text-base line-clamp-2 mb-2">
                        {product.title}
                      </CardTitle>
                      {typeof product.retailPrice === "number" && (
                        <p className="text-lg font-semibold mb-2">
                          ${product.retailPrice.toFixed(2)}
                        </p>
                      )}
                      <CardDescription className="flex gap-2 flex-wrap line-clamp-2">
                        <Badge variant="secondary">
                          {product.categoryName ?? ""}
                        </Badge>
                        <Badge variant="outline">
                          {product.subCategoryName ?? ""}
                        </Badge>
                      </CardDescription>
                    </CardContent>
                    <CardFooter className="mt-auto shrink-0">
                      <Button variant="outline" className="w-full">
                        View Details
                      </Button>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
            {totalProducts > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {safePage} of {maxPage}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p: number) =>
                      Math.min(Math.max(1, Math.ceil(totalProducts / PAGE_SIZE)), p + 1)
                    )
                  }
                  disabled={safePage >= maxPage}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
