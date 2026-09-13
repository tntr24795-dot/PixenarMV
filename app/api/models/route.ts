import { NextResponse } from "next/server";
import { videoModels } from "@/lib/models";
export function GET(){ return NextResponse.json({models:videoModels}); }
