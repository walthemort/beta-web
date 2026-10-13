/**
 * Icons for posts – arrows, contact details, shopping, food, seasons, badges – drawn as lines in a
 * brand colour. A hand-picked set, so the editor stays quick to load.
 */
import type { ComponentType, CSSProperties } from 'react'
import {
  ArrowDown, ArrowRight, ArrowUpRight, AtSign, Award, Bell, Bike, Briefcase, Building2, Calendar, Camera, Car, ChartColumn, Check, ChevronRight, CircleAlert, CircleCheck,
  Clock, Coffee, Crown, Download, Droplet, Dumbbell, Flame, Flower2, Gift, Globe, Hammer, Hash, Heart, Home, Image, Info, Leaf, Lightbulb, Link, Lock, Mail, MapPin,
  Megaphone, MessageCircle, Mic, Moon, Mountain, Music, Package, Paintbrush, Palette, PenTool, Percent, Phone, Plane, Play, Plus, Quote, Recycle, Rocket, Scissors,
  Search, Send, Shield, ShoppingBag, ShoppingCart, Smile, Sparkles, Star, Sun, Tag, Target, ThumbsUp, Ticket, TrendingUp, Trophy, Truck, User, Users, Utensils, Video,
  Wifi, Wind, Wrench, X, Zap,
} from 'lucide-react'

type Icon = ComponentType<{ size?: number | string; color?: string; strokeWidth?: number; absoluteStrokeWidth?: boolean; style?: CSSProperties }>

/** Name → icon, grouped roughly by what they're for. */
export const ICONS: Record<string, Icon> = {
  'arrow-right': ArrowRight, 'arrow-up-right': ArrowUpRight, 'arrow-down': ArrowDown, 'chevron-right': ChevronRight, check: Check, 'circle-check': CircleCheck, x: X, plus: Plus,
  star: Star, heart: Heart, 'thumbs-up': ThumbsUp, sparkles: Sparkles, zap: Zap, flame: Flame, award: Award, trophy: Trophy, crown: Crown, target: Target,
  'shopping-bag': ShoppingBag, 'shopping-cart': ShoppingCart, tag: Tag, percent: Percent, gift: Gift, ticket: Ticket, package: Package, truck: Truck,
  calendar: Calendar, clock: Clock, 'map-pin': MapPin, phone: Phone, mail: Mail, globe: Globe, link: Link, 'at-sign': AtSign, 'message-circle': MessageCircle, send: Send, bell: Bell, megaphone: Megaphone,
  camera: Camera, image: Image, play: Play, video: Video, music: Music, mic: Mic, quote: Quote, hash: Hash, info: Info, alert: CircleAlert, search: Search, download: Download, wifi: Wifi, lock: Lock, shield: Shield,
  home: Home, building: Building2, briefcase: Briefcase, users: Users, user: User, smile: Smile, 'trending-up': TrendingUp, chart: ChartColumn, lightbulb: Lightbulb, rocket: Rocket,
  sun: Sun, moon: Moon, leaf: Leaf, flower: Flower2, droplet: Droplet, wind: Wind, mountain: Mountain, recycle: Recycle,
  coffee: Coffee, utensils: Utensils, plane: Plane, car: Car, bike: Bike, dumbbell: Dumbbell,
  palette: Palette, 'pen-tool': PenTool, paintbrush: Paintbrush, scissors: Scissors, wrench: Wrench, hammer: Hammer,
}

export const ICON_NAMES = Object.keys(ICONS)

/** An icon filling its layer; the line grows with it, like any artwork. */
export function IconMark({ name, colour, strokeWidth }: { name: string; colour: string; strokeWidth: number }) {
  const I = ICONS[name] ?? Star
  return <I size="100%" color={colour} strokeWidth={strokeWidth} style={{ display: 'block' }} />
}
