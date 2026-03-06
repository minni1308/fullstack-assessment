import { NextRequest, NextResponse } from 'next/server';
import { productService } from '@/lib/products';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(value: string | null, defaultVal: number, max?: number): number {
  const parsed = value != null ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return defaultVal;
  if (max != null && parsed > max) return max;
  return parsed;
}

function parseNonNegativeInt(value: string | null, defaultVal: number): number {
  const parsed = value != null ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return defaultVal;
  return parsed;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const filters = {
    category: searchParams.get('category') || undefined,
    subCategory: searchParams.get('subCategory') || undefined,
    search: searchParams.get('search') || undefined,
    limit: parsePositiveInt(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT),
    offset: parseNonNegativeInt(searchParams.get('offset'), 0),
  };

  const products = productService.getAll(filters);
  const total = productService.getTotalCount({
    category: filters.category,
    subCategory: filters.subCategory,
    search: filters.search,
  });

  return NextResponse.json({
    products,
    total,
    limit: filters.limit,
    offset: filters.offset,
  });
}
