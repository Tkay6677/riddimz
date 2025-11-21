"use client";

import React, { useState } from "react";
import { Search, Filter, Grid3X3, List, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface MarketplaceHeaderProps {
  onSearch?: (query: string) => void;
  onSortChange?: (sort: string) => void;
  onViewChange?: (view: 'grid' | 'list') => void;
  totalItems?: number;
  view?: 'grid' | 'list';
}

export function MarketplaceHeader({ 
  onSearch, 
  onSortChange, 
  onViewChange, 
  totalItems = 0,
  view = 'grid'
}: MarketplaceHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-2xl p-8 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20 rounded-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">Riddimz Marketplace</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">Discover Music NFTs</h1>
          <p className="text-lg opacity-90 max-w-2xl">
            Explore, collect, and trade unique music NFTs from talented creators worldwide
          </p>
          <div className="flex items-center gap-4 mt-4">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {totalItems.toLocaleString()} Items
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              Live Marketplace
            </Badge>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex-1 max-w-md">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search music NFTs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-background/50 backdrop-blur-sm border-border/50"
            />
          </form>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort Options */}
          <Select onValueChange={onSortChange} defaultValue="recent">
            <SelectTrigger className="w-[140px] h-11">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently Listed</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="alphabetical">A-Z</SelectItem>
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6" />

          {/* View Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={view === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange?.('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange?.('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Filter Button */}
          <Button variant="outline" size="sm" className="h-11 px-4">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>
    </div>
  );
}