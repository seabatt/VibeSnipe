# Post-Deployment Verification Checklist

Use this checklist to verify your deployment is working correctly.

## ✅ Functional Testing

### Routes & Navigation
- [ ] Application loads without errors
- [ ] No console errors in browser DevTools
- [ ] All routes accessible
- [ ] Navigation works correctly

### Theme System
- [ ] Theme toggle works (Light/Dark/Auto)
- [ ] Theme persists on page reload
- [ ] Theme transitions are smooth (<100ms)
- [ ] All components respect theme colors
- [ ] Charts recolor instantly on theme switch

### Trade Entry Flows
- [ ] **Discord Paste**:
  - [ ] Paste Discord alert text
  - [ ] Parsing works correctly
  - [ ] Incomplete token chips appear if needed
  - [ ] Strike nudge controls work (⇧↑/⇧↓)
  - [ ] Price nudge controls work (↑/↓)
  - [ ] "Set to Mid" button works

- [ ] **Preset Entry**:
  - [ ] Presets auto-arm at block open
  - [ ] "Ready" status chip appears
  - [ ] Countdown timer displays correctly
  - [ ] Direction toggle works (CALL/PUT)
  - [ ] Δ-Snap button works

- [ ] **Manual Build**:
  - [ ] Underlying selector works
  - [ ] Strategy selector works
  - [ ] Delta slider works
  - [ ] Width slider works
  - [ ] Δ-Snap button works

### Order Preview
- [ ] Spread price displays (Bid/Mid/Ask/Last)
- [ ] Live indicator shows quote age
- [ ] Staleness warning appears (≥1.5s)
- [ ] Max Loss/Gain calculated correctly
- [ ] TP/SL steppers work (±5%)
- [ ] Time Exit toggle works
- [ ] Price nudge controls work
- [ ] Strike nudge controls work
- [ ] Preflight checks display correctly
- [ ] Execute button works (or shows correct disabled state)

### Risk Graph
- [ ] Risk graph renders without errors
- [ ] P/L curve displays correctly
- [ ] Current price reference line appears
- [ ] Breakeven reference line appears
- [ ] TP/SL reference lines appear when set
- [ ] Hover shows price/P/L information
- [ ] Graph updates when order changes

### Day HUD
- [ ] Current block displays correctly
- [ ] Countdown timer updates (mm:ss)
- [ ] Strategy and underlying shown
- [ ] Rule chips display
- [ ] Scalp counter works (x/3)
- [ ] Exposure meters display
- [ ] Next block shown

### Positions Panel
- [ ] Positions list displays (even if empty)
- [ ] Positions show correct information
- [ ] Close button works (if positions exist)
- [ ] Change Target button works (if positions exist)
- [ ] Change Stop button works (if positions exist)

### UI Components
- [ ] Buttons have hover/press states
- [ ] Inputs focus correctly
- [ ] SegmentedTabs switch correctly
- [ ] Toast notifications appear (if triggered)
- [ ] Tooltips display (if used)

## ✅ Performance Testing

### Lighthouse Scores
- [ ] **Performance**: Score > 80
- [ ] **Accessibility**: Score > 90
- [ ] **Best Practices**: Score > 90
- [ ] **SEO**: Score > 80 (if applicable)

### Load Times
- [ ] **First Contentful Paint (FCP)**: < 2s
- [ ] **Largest Contentful Paint (LCP)**: < 2.5s
- [ ] **Time to Interactive (TTI)**: < 3s
- [ ] **Total Blocking Time (TBT)**: < 200ms
- [ ] **Cumulative Layout Shift (CLS)**: < 0.1

### Bundle Size
- [ ] Total JavaScript bundle < 500KB (gzipped)
- [ ] Total CSS bundle < 50KB (gzipped)
- [ ] Plotly.js loaded efficiently (code-split if possible)

### Runtime Performance
- [ ] No layout shifts during load
- [ ] Smooth scrolling
- [ ] Fast component updates (<200ms)
- [ ] No memory leaks (check with DevTools Memory profiler)
- [ ] Efficient re-renders (check with React DevTools Profiler)

## ✅ Mobile Testing

### Responsive Design
- [ ] Layout works on **iPhone** (375px - 428px width)
- [ ] Layout works on **Android** (360px - 412px width)
- [ ] Layout works on **Tablet** (768px - 1024px width)
- [ ] Touch interactions work
- [ ] Text is readable without zooming
- [ ] Buttons are large enough for touch

### Mobile-Specific
- [ ] Keyboard shortcuts don't interfere with mobile
- [ ] Paste functionality works on mobile
- [ ] Forms are usable on mobile
- [ ] Scroll behavior is smooth

## ✅ Browser Compatibility

### Desktop Browsers
- [ ] **Chrome/Edge** (latest): All features work
- [ ] **Firefox** (latest): All features work
- [ ] **Safari** (latest): All features work

### Mobile Browsers
- [ ] **Mobile Safari** (iOS): All features work
- [ ] **Chrome Mobile** (Android): All features work

### Known Issues
- [ ] Document any browser-specific issues found

## ✅ Error Handling

### Error Boundaries
- [ ] Root error boundary catches errors
- [ ] Component-level error boundaries catch errors
- [ ] Error messages display correctly
- [ ] "Try again" button works
- [ ] Error stack shows in development mode

### Network Errors
- [ ] Failed API calls show error messages
- [ ] Timeout errors handled gracefully
- [ ] Offline mode handled (if applicable)

### Validation Errors
- [ ] Form validation errors display
- [ ] Trade validation errors display
- [ ] Preflight check errors display

## ✅ Accessibility

### Keyboard Navigation
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] Tab order logical
- [ ] Keyboard shortcuts work (⌘V, Enter, ↑/↓, ⇧↑/⇧↓)

### Screen Readers
- [ ] Semantic HTML used
- [ ] ARIA labels where needed
- [ ] Form labels associated correctly
- [ ] Error messages announced

### Visual
- [ ] Color contrast ≥ 4.5:1 (all text)
- [ ] Color contrast ≥ 3:1 (non-text elements)
- [ ] No color-only information
- [ ] Focus indicators visible (2px outline)

## ✅ Security

### Environment Variables
- [ ] No secrets exposed in client-side code
- [ ] API keys not in client bundle
- [ ] Environment variables set correctly in platform

### Headers
- [ ] HTTPS enforced
- [ ] Security headers configured (if applicable)
- [ ] CORS configured correctly (if applicable)

## ✅ Monitoring & Analytics

### Error Tracking
- [ ] Error tracking configured (if applicable)
- [ ] Errors logged correctly
- [ ] Error alerts set up (if applicable)

### Analytics
- [ ] Analytics configured (if applicable)
- [ ] Events tracked correctly

### Performance Monitoring
- [ ] Performance monitoring configured (if applicable)
- [ ] Core Web Vitals tracked

## ✅ Documentation

### README
- [ ] README.md up to date
- [ ] Deployment instructions clear
- [ ] Environment variables documented

### Code Documentation
- [ ] Key components documented (if applicable)
- [ ] API endpoints documented (if applicable)

## Common Issues & Fixes

### Build Errors
**Issue**: Build fails in production  
**Fix**: Check Node.js version (needs 18+), verify all dependencies installed

### Runtime Errors
**Issue**: White screen or error messages  
**Fix**: Check browser console, verify environment variables set, check error boundaries

### Performance Issues
**Issue**: Slow load times  
**Fix**: Check bundle size, verify code splitting, optimize images/assets

### Theme Issues
**Issue**: Theme not switching  
**Fix**: Check ThemeProvider setup, verify CSS variables, check localStorage

### Quote/Data Issues
**Issue**: No data showing  
**Fix**: Check QuoteBus connection, verify mock data, check Zustand stores

## Post-Verification Steps

1. **Document Issues**: Note any issues found during testing
2. **Fix Critical Issues**: Fix any blocking issues before going live
3. **Monitor**: Watch error logs and performance metrics
4. **Iterate**: Continue improving based on real-world usage

## Success Criteria

✅ **Ready for Production**:
- All critical features work
- Performance scores acceptable
- No blocking errors
- Mobile experience acceptable
- Security configured correctly

❌ **Not Ready**:
- Critical features broken
- Performance unacceptable
- Security issues
- Accessibility failures

