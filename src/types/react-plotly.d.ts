declare module 'react-plotly.js' {
  import { Component } from 'react';
  
  interface PlotParams {
    data: any[];
    layout?: any;
    config?: any;
    frames?: any[];
    revision?: number;
    onInitialized?: (figure: any, graphDiv: HTMLDivElement) => void;
    onUpdate?: (figure: any, graphDiv: HTMLDivElement) => void;
    onPurge?: (figure: any, graphDiv: HTMLDivElement) => void;
    onError?: (err: Error) => void;
    debug?: boolean;
    useResizeHandler?: boolean;
    style?: React.CSSProperties;
    className?: string;
  }

  class Plot extends Component<PlotParams> {}
  export default Plot;
}

