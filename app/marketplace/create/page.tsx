"use client";

import React from "react";
import CreatorListingForm from "@/components/marketplace/CreatorListingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketplaceCreatePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">List a Song</h1>
        <p className="text-sm text-muted-foreground">
          Create a marketplace listing for your song.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create Listing</CardTitle>
        </CardHeader>
        <CardContent>
          <CreatorListingForm />
        </CardContent>
      </Card>
    </div>
  );
}