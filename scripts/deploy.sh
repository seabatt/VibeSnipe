#!/bin/bash

# VibeSnipe Production Deployment Script
# This script handles pre-deployment checks, builds, and deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Pre-deployment checks
pre_deployment_checks() {
  print_header "Pre-Deployment Checks"
  
  # Check Node.js
  if ! command_exists node; then
    print_error "Node.js is not installed"
    exit 1
  fi
  NODE_VERSION=$(node -v)
  print_success "Node.js version: $NODE_VERSION"
  
  # Check npm
  if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
  fi
  NPM_VERSION=$(npm -v)
  print_success "npm version: $NPM_VERSION"
  
  # Check if we're in the right directory
  if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the project root?"
    exit 1
  fi
  
  # Check git status
  if command_exists git; then
    if [ -d ".git" ]; then
      GIT_STATUS=$(git status --porcelain)
      if [ -n "$GIT_STATUS" ]; then
        print_warning "Working directory has uncommitted changes"
        read -p "Do you want to commit changes before deploying? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
          git add -A
          git commit -m "chore: pre-deployment commit $(date +%Y-%m-%d\ %H:%M:%S)"
          print_success "Changes committed"
        fi
      else
        print_success "Working directory is clean"
      fi
    fi
  fi
  
  print_success "Pre-deployment checks passed"
}

# Install dependencies
install_dependencies() {
  print_header "Installing Dependencies"
  
  if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    print_info "Installing npm dependencies..."
    npm ci
    print_success "Dependencies installed"
  else
    print_success "Dependencies up to date"
  fi
}

# Run linting
run_lint() {
  print_header "Running Lint Checks"
  
  if npm run lint --silent 2>/dev/null; then
    print_success "Lint checks passed"
  else
    print_error "Lint checks failed"
    print_warning "Fix linting errors before deploying"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
}

# Type check
type_check() {
  print_header "Running TypeScript Type Check"
  
  if npx tsc --noEmit --pretty 2>/dev/null; then
    print_success "Type check passed"
  else
    print_error "Type check failed"
    print_warning "Fix type errors before deploying"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
}

# Build application
build_app() {
  print_header "Building Application"
  
  print_info "Running production build..."
  if npm run build; then
    print_success "Build completed successfully"
  else
    print_error "Build failed"
    exit 1
  fi
  
  # Check if .next directory exists
  if [ -d ".next" ]; then
    print_success "Build output directory (.next) exists"
  else
    print_error "Build output directory not found"
    exit 1
  fi
}

# Deploy to Vercel
deploy_vercel() {
  print_header "Deploying to Vercel"
  
  if ! command_exists vercel; then
    print_warning "Vercel CLI not installed"
    print_info "Installing Vercel CLI..."
    npm i -g vercel
  fi
  
  print_info "Starting Vercel deployment..."
  
  read -p "Deploy to production? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    vercel --prod --yes
    print_success "Deployed to production"
  else
    vercel --yes
    print_success "Deployed to preview"
    print_info "Run 'vercel --prod' to deploy to production"
  fi
}

# Deploy to Netlify
deploy_netlify() {
  print_header "Deploying to Netlify"
  
  if ! command_exists netlify; then
    print_warning "Netlify CLI not installed"
    print_info "Installing Netlify CLI..."
    npm i -g netlify-cli
  fi
  
  print_info "Starting Netlify deployment..."
  
  read -p "Deploy to production? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    netlify deploy --prod
    print_success "Deployed to production"
  else
    netlify deploy
    print_success "Deployed to draft"
    print_info "Run 'netlify deploy --prod' to deploy to production"
  fi
}

# Main deployment flow
main() {
  print_header "VibeSnipe Production Deployment"
  
  # Parse command line arguments
  DEPLOYMENT_TARGET=""
  SKIP_CHECKS=false
  
  while [[ $# -gt 0 ]]; do
    case $1 in
      --vercel)
        DEPLOYMENT_TARGET="vercel"
        shift
        ;;
      --netlify)
        DEPLOYMENT_TARGET="netlify"
        shift
        ;;
      --skip-checks)
        SKIP_CHECKS=true
        shift
        ;;
      --help)
        echo "Usage: ./scripts/deploy.sh [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --vercel       Deploy to Vercel (default)"
        echo "  --netlify      Deploy to Netlify"
        echo "  --skip-checks  Skip pre-deployment checks"
        echo "  --help         Show this help message"
        exit 0
        ;;
      *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
    esac
  done
  
  # Run pre-deployment checks unless skipped
  if [ "$SKIP_CHECKS" = false ]; then
    pre_deployment_checks
    install_dependencies
    run_lint
    type_check
  fi
  
  # Build application
  build_app
  
  # Deploy
  if [ -z "$DEPLOYMENT_TARGET" ]; then
    # Default to Vercel
    DEPLOYMENT_TARGET="vercel"
  fi
  
  case $DEPLOYMENT_TARGET in
    vercel)
      deploy_vercel
      ;;
    netlify)
      deploy_netlify
      ;;
    *)
      print_error "Unknown deployment target: $DEPLOYMENT_TARGET"
      exit 1
      ;;
  esac
  
  print_header "Deployment Complete!"
  print_success "Your application has been deployed successfully"
  print_info "Don't forget to:"
  print_info "  1. Test the deployed application"
  print_info "  2. Check POST_DEPLOYMENT_CHECKLIST.md"
  print_info "  3. Monitor error logs in your deployment platform"
}

# Run main function
main "$@"

