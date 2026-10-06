import { NextResponse } from "next/server";
import { videoModels } from "@/lib/models";
import { hasVideoProviderConfiguration } from "@/lib/providers/video";
export function GET(){ return NextResponse.json({models:videoModels.map(model => ({...model, available:model.available && hasVideoProviderConfiguration(model.id)}))}); }
