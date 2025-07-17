<script lang="ts">
	let canvasSv: HTMLCanvasElement;

	class CustomChart {
		private offscreen: OffscreenCanvas;
		private canvas: HTMLCanvasElement;

		private length: number;
		private minY: number;
		private maxY: number;
		private range: number;
		private width: number;
		private height: number;
		private scale: number;
		private lastY: number | null;
		private padding: number = 10;

		constructor(canvas: HTMLCanvasElement) {
			this.canvas = canvas;
			this.offscreen = new OffscreenCanvas(canvas.width, canvas.height);
			this.width = canvas.width;
			this.height = canvas.height;
			this.length = 0;
			this.minY = 0;
			this.maxY = 0;
			this.range = 0;
			this.scale = 1;
			this.lastY = null;

			this.updateDimensions(canvas.width, canvas.height);
		}

		public updateDimensions(canvasX: number, canvasY: number) {
			this.canvas.style.width = canvasX + "px";
			this.canvas.style.height = canvasY + "px";
			this.scale = window.devicePixelRatio; // Change to 1 on retina screens to see blurry canvas.
			this.canvas.width = Math.ceil(canvasX * this.scale);
			this.canvas.height = Math.ceil(canvasY * this.scale);

			this.offscreen.width = Math.ceil(canvasX * this.scale);
			this.offscreen.height = Math.ceil(canvasY * this.scale);

			this.width = canvasX;
			this.height = canvasY;

			this.canvas.getContext("2d")?.scale(this.scale, this.scale);
			this.offscreen.getContext("2d")?.scale(this.scale, this.scale);
		}

		public streamUpdate(newData: number[]) {
			const ctx = this.offscreen.getContext("2d");
			if (!ctx) return;

			const [newMinY, newMaxY] = this.findMinMax(newData);
			if (newMinY < this.minY) this.minY = newMinY;
			if (newMaxY > this.maxY) this.maxY = newMaxY;

			const newRange = this.maxY - this.minY;
			const newLength = this.length + newData.length;
			const yScale = newRange > this.range ? this.range / newRange : 1;

			if (newRange > this.range) this.range = newRange;

			const normalize = (val: number) => (val - this.minY) / this.range;

			console.log(this.range);
			console.log(newData.map((x) => normalize(x)));

			ctx.save(); // Save the current context state
			ctx.clearRect(0, 0, this.width, this.height);
			ctx.fillStyle = "#ee0000";
			//ctx.fillRect(0, 0, this.width, this.height);

			ctx.scale(this.length / newLength || 1.0, yScale);
			ctx.drawImage(this.canvas, 0, 0, this.width, this.height);
			ctx.restore();

			const scaleY = this.height - 2 * this.padding;
			const scaleX = (this.width - 2 * this.padding) / newLength;

			ctx.beginPath();
			if (this.lastY !== null) {
				ctx.moveTo(
					Math.floor((this.length - 1) * scaleX) +
						this.padding * (this.length / newLength),
					this.height -
						Math.floor(normalize(this.lastY) * scaleY) -
						this.padding,
				);
				ctx.lineTo(
					Math.floor(this.length * scaleX) + this.padding,
					this.height -
						Math.floor(normalize(newData[0]) * scaleY) -
						this.padding,
				);
			}
			for (let i = 0; i < newData.length - 1; i++) {
				console.log(
					Math.floor((this.length + i) * scaleX) + this.padding,
					this.height -
						Math.floor(normalize(newData[i]) * scaleY) -
						this.padding,
					"->",
					Math.floor((this.length + i + 1) * scaleX) + this.padding,
					this.height -
						Math.floor(normalize(newData[i + 1]) * scaleY) -
						this.padding,
				);
				ctx.moveTo(
					Math.floor((this.length + i) * scaleX) + this.padding,
					this.height -
						Math.floor(normalize(newData[i]) * scaleY) -
						this.padding,
				);
				ctx.lineTo(
					Math.floor((this.length + i + 1) * scaleX) + this.padding,
					this.height -
						Math.floor(normalize(newData[i + 1]) * scaleY) -
						this.padding,
				);
			}
			ctx.closePath();
			ctx.stroke();

			const onCTX = this.canvas.getContext("2d");
			if (!onCTX) return;
			console.log(this.width, this.height);
			onCTX.clearRect(0, 0, this.width, this.height);
			onCTX.drawImage(
				this.offscreen.transferToImageBitmap(),
				0,
				0,
				300,
				150,
			);

			this.lastY = newData[newData.length - 1];
			this.length = newLength;
		}

		private findMinMax(arr: number[]) {
			let yMin = arr[0];
			let yMax = arr[0];
			for (let i = 1; i < arr.length; i++) {
				if (arr[i] < yMin) yMin = arr[i];
				if (arr[i] > yMax) yMax = arr[i];
			}

			return [yMin, yMax];
		}
	}
</script>

<div>
	<canvas bind:this={canvasSv} width="256" height="256"></canvas>
</div>
