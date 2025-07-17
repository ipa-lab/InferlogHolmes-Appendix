import pandas as pd
import glob
import matplotlib.pyplot as plt
import numpy as np
import scipy.stats as stats
import matplotlib.patches as mpatches
from matplotlib.patches import Patch
from IPython.display import display, HTML
from lifelines.statistics import logrank_test, KaplanMeierFitter
from lifelines import CoxPHFitter
import seaborn as sns
from cliffs_delta import cliffs_delta

def plot_shapiro_test_matrix(df, column_name, alpha=0.05):
	"""
	Create a matrix plot showing Shapiro-Wilk test statistics and p-values
	for each Task and order combination for a specified column.
	
	Parameters:
	df (DataFrame): The pandas DataFrame
	column_name (str): The column to test for normality
	alpha (float): Significance level, defaults to 0.05
	"""
	
	# Create figure
	fig, ax = plt.subplots(figsize=(10, 6))
	
	# Define tasks and orders
	tasks = ['A', 'B', 'C']
	orders = [1, 2, 3]
	
	# Create empty arrays to store results
	stats_matrix = np.zeros((3, 3))
	pvals_matrix = np.zeros((3, 3))
	counts_matrix = np.zeros((3, 3))
	
	# Calculate Shapiro-Wilk for each Task and order
	for t_idx, task in enumerate(tasks):
		for o_idx, order in enumerate(orders):
			# Filter data for this Task and order
			data = df[(df['Task'] == task) & (df['order'] == order)][column_name].dropna()
			counts_matrix[t_idx, o_idx] = len(data)
			
			# Need at least 3 data points for Shapiro-Wilk test
			if len(data) >= 3:
				stat, p = stats.shapiro(data)
				stats_matrix[t_idx, o_idx] = stat
				pvals_matrix[t_idx, o_idx] = p
			else:
				stats_matrix[t_idx, o_idx] = np.nan
				pvals_matrix[t_idx, o_idx] = np.nan
	
	# Create a grid for the matrix
	ax.set_xlim(-0.5, 2.5)
	ax.set_ylim(-0.5, 2.5)
	
	# Draw grid lines
	for i in range(4):
		ax.axhline(i-0.5, color='black', linewidth=1)
		ax.axvline(i-0.5, color='black', linewidth=1)
	
	# Fill cells with results
	for t_idx, task in enumerate(tasks):
		for o_idx, order in enumerate(orders):
			stat = stats_matrix[t_idx, o_idx]
			pval = pvals_matrix[t_idx, o_idx]
			count = counts_matrix[t_idx, o_idx]
			
			# Skip if not enough data
			if np.isnan(stat):
				color = 'lightgray'
				text = f"Task {task}, Order {order}\nCount: {int(count)}\nInsufficient data"
			else:
				# Determine cell color based on significance
				if pval < alpha:
					color = 'salmon'  # Not normal (significant)
				else:
					color = 'lightgreen'  # Normal (not significant)
				
				text = f"Task {task}, Order {order}\nCount: {int(count)}\nStat: {stat:.3f}\np-value: {pval:.3f}"
			
			# Create the cell
			rect = plt.Rectangle((o_idx-0.5, 2-t_idx-0.5), 1, 1, fill=True, color=color, alpha=0.7)
			ax.add_patch(rect)
			
			# Add text
			ax.text(o_idx, 2-t_idx, text, ha='center', va='center', fontsize=9)
	
	# Set labels
	ax.set_xticks([0, 1, 2])
	ax.set_xticklabels(['Order 1', 'Order 2', 'Order 3'])
	ax.set_yticks([0, 1, 2])
	ax.set_yticklabels(['Task C', 'Task B', 'Task A'])
	
	# Set title
	ax.set_title(f'Shapiro-Wilk Test for Normality: {column_name}')
	
	# Add legend
	red_patch = mpatches.Patch(color='salmon', label='Not Normal (p < 0.05)')
	green_patch = mpatches.Patch(color='lightgreen', label='Normal (p ≥ 0.05)')
	gray_patch = mpatches.Patch(color='lightgray', label='Insufficient Data')
	ax.legend(handles=[red_patch, green_patch, gray_patch], loc='upper center', 
			  bbox_to_anchor=(0.5, -0.05), ncol=3)
	
	plt.tight_layout()
	plt.show()
	
	return fig, ax

def create_beautiful_boxplot(df, column_of_interest, percent_scale=False, replace_zeros=True, remove_nan=True, add_nan_counts=False, add_p_values=True):
	# Create a figure
	fig, ax = plt.subplots(figsize=(12, 7))

	# Define tasks
	tasks = ['A', 'B', 'C']
	positions = np.arange(len(tasks))
	width = 0.35

	# Define colors
	colors = {
		'without_fill': '#E8F4F9',
		'without_edge': '#3182BD',
		'with_fill': '#E8F9EF',
		'with_edge': '#31A354'
	}

	# Lists to store data and statistics
	data_without = []
	data_with = []
	means_without = []
	means_with = []
	stds_without = []
	stds_with = []
	p_values = []

	# Process data for each task
	for i, task in enumerate(tasks):
		# Filter data for this task
		task_df = df[df['Task'] == task]
		if replace_zeros:
			task_df = task_df.replace(0.0, np.nan)

		if add_nan_counts:
			count_without = task_df[task_df['order'] == 1]['Task'].count()
			count_with = task_df[task_df['order'].isin([2,3])]['Task'].count() 
			nan_count_without = task_df[task_df['order'] == 1][column_of_interest].isna().sum()
			nan_count_with = task_df[task_df['order'].isin([2,3])][column_of_interest].isna().sum()

			ax.text(positions[i]-width/2, ax.get_ylim()[1]*0.95, f"{count_without - nan_count_without}/{count_without} valid points", 
        	            ha='center', va='top', color=colors['without_edge'], fontsize=9, fontweight='bold')
			ax.text(positions[i]+width/2, ax.get_ylim()[1]*0.95, f"{count_with - nan_count_with}/ {count_with} valid points", 
        	            ha='center', va='top', color=colors['with_edge'], fontsize=9, fontweight='bold')

		# Remove NaN values if specified
		if remove_nan:
			task_df = task_df.dropna(subset=[column_of_interest])
		
		# Data without tool (order = 1)
		without_tool = task_df[task_df['order'] == 1][column_of_interest]
		
		data_without.append(without_tool)
		means_without.append(without_tool.mean())
		stds_without.append(without_tool.std())

		# Data with tool (order in [2, 3])
		with_tool = task_df[task_df['order'].isin([2, 3])][column_of_interest]
		data_with.append(with_tool)
		means_with.append(with_tool.mean())
		stds_with.append(with_tool.std())

		# Perform Mann-Whitney U test
		stat, p = stats.mannwhitneyu(with_tool, without_tool, alternative='two-sided')
		p_values.append(p)

	# Create boxplots
	bp1 = ax.boxplot(data_without, positions=positions-width/2, patch_artist=True, 
					widths=width, showmeans=True)
	bp2 = ax.boxplot(data_with, positions=positions+width/2, patch_artist=True, 
					widths=width, showmeans=True)

	# Customize boxplots
	for box in bp1['boxes']:
		box.set_facecolor(colors['without_fill'])
		box.set_edgecolor(colors['without_edge'])
		box.set_linewidth(1.5)

	for box in bp2['boxes']:
		box.set_facecolor(colors['with_fill'])
		box.set_edgecolor(colors['with_edge'])
		box.set_linewidth(1.5)

	for element in ['whiskers', 'caps']:
		for item in bp1[element]:
			item.set_color(colors['without_edge'])
			item.set_linewidth(1.5)
		for item in bp2[element]:
			item.set_color(colors['with_edge'])
			item.set_linewidth(1.5)

	for i, mean in enumerate(bp1['means']):
		mean.set_marker('D')
		mean.set_markerfacecolor('red')
		mean.set_markeredgecolor('black')
		mean.set_markersize(8)

	for i, mean in enumerate(bp2['means']):
		mean.set_marker('D')
		mean.set_markerfacecolor('red')
		mean.set_markeredgecolor('black')
		mean.set_markersize(8)

	# Add individual data points with jitter
	for i, task_data in enumerate(data_without):
		ax.scatter(np.random.normal(positions[i]-width/2, 0.04, size=len(task_data)), 
				   task_data, color=colors['without_edge'], alpha=0.7, s=50)

	for i, task_data in enumerate(data_with):
		ax.scatter(np.random.normal(positions[i]+width/2, 0.04, size=len(task_data)), 
				   task_data, color=colors['with_edge'], alpha=0.7, s=50)

	# Add p-values annotations
	if add_p_values:
		for i, p in enumerate(p_values):
			if p < 0.05:
				p_text = f"p = {p:.4f} *"
				color = 'red'
			else:
				p_text = f"p = {p:.4f}"
				color = 'black'
	
			ax.text(positions[i], 15 if percent_scale else 0.5, p_text, ha='center', va='center', 
					color=color, fontsize=11, fontweight='bold',
					bbox=dict(facecolor='white', alpha=0.9, boxstyle='round,pad=0.3'))

	# Add mean ± std annotations
	for i in range(len(tasks)):
		# For without tool
		without_text = f"{means_without[i]:.1f} ± {stds_without[i]:.1f}"
		ax.annotate(without_text, xy=(positions[i]-width/2, means_without[i]),
					xytext=(positions[i]-width/2, means_without[i] + 10 if percent_scale else 0.5),
					ha='center', va='bottom', color=colors['without_edge'],
					fontsize=9, fontweight='bold')

		# For with tool
		with_text = f"{means_with[i]:.1f} ± {stds_with[i]:.1f}"
		ax.annotate(with_text, xy=(positions[i]+width/2, means_with[i]),
					xytext=(positions[i]+width/2, means_with[i] + 10 if percent_scale else 0.5),
					ha='center', va='bottom', color=colors['with_edge'],
					fontsize=9, fontweight='bold')

	# Set labels and title
	ax.set_title(f'{column_of_interest}: Without Tool vs. With Tool', fontsize=16)
	if percent_scale:
		ax.set_ylabel(f'{column_of_interest} (%)', fontsize=14)
	else:
		ax.set_ylabel(f'{column_of_interest} (seconds)', fontsize=14)
	ax.set_xticks(positions)
	ax.set_xticklabels([f'Task {t}' for t in tasks], fontsize=14)
	if percent_scale:
		ax.set_ylim(-5, 105)

	# Add grid lines
	ax.grid(axis='y', linestyle='--', alpha=0.3)

	# Add legend
	legend_elements = [
		Patch(facecolor=colors['without_fill'], edgecolor=colors['without_edge'], 
			  label='Without Tool (Order 1)'),
		Patch(facecolor=colors['with_fill'], edgecolor=colors['with_edge'], 
			  label='With Tool (Orders 2 & 3)'),
		plt.Line2D([0], [0], marker='D', color='w', markerfacecolor='red', 
				  markeredgecolor='black', markersize=8, label='Mean Value')
	]
	ax.legend(handles=legend_elements, loc='upper center', bbox_to_anchor=(0.5, -0.12), 
			 ncol=3, frameon=True, fontsize=12)

	plt.tight_layout()
	plt.subplots_adjust(bottom=0.15)  # Make room for the legend
	

def perform_mann_whitney_test(df, column_name, task, alpha=0.05, replace_zeros=False):
	"""
	Perform Mann-Whitney U tests comparing orders for a specific task and column.
	Display results in a colored matrix.
	
	Parameters:
	df (DataFrame): The pandas DataFrame
	column_name (str): The column to test
	task (str): The task to analyze (e.g., 'A', 'B', 'C')
	alpha (float): Significance level, defaults to 0.05
	replace_zeros (bool): Whether to treat zeros as missing values
	"""
	
	# Filter dataframe for the specified task
	task_df = df[df['Task'] == task].copy()
	
	# Replace zeros with NaN if requested
	if replace_zeros:
		task_df[column_name] = task_df[column_name].replace(0.0, np.nan)
	
	# Create figure
	fig, ax = plt.subplots(figsize=(10, 8))
	
	# Define orders
	orders = [1, 2, 3]
	
	# Create empty arrays to store results
	stat_matrix = np.zeros((3, 3))
	pval_matrix = np.zeros((3, 3))
	counts_matrix = np.zeros((3, 3, 2))  # To store sample sizes [order i, order j]
	means_matrix = np.zeros((3, 3, 2))   # To store means [order i, order j]
	medians_matrix = np.zeros((3, 3, 2)) # To store medians [order i, order j]
	
	# Prepare data for each order
	order_data = {}
	for order in orders:
		data = task_df[task_df['order'] == order][column_name].dropna()
		order_data[order] = data
	
	# Perform Mann-Whitney U test for each pair of orders
	for i, order1 in enumerate(orders):
		for j, order2 in enumerate(orders):
			data1 = order_data[order1]
			data2 = order_data[order2]
			
			# Store sample sizes
			counts_matrix[i, j, 0] = len(data1)
			counts_matrix[i, j, 1] = len(data2)
			
			# Store means and medians if data available
			if len(data1) > 0:
				means_matrix[i, j, 0] = np.mean(data1)
				medians_matrix[i, j, 0] = np.median(data1)
			else:
				means_matrix[i, j, 0] = np.nan
				medians_matrix[i, j, 0] = np.nan
				
			if len(data2) > 0:
				means_matrix[i, j, 1] = np.mean(data2)
				medians_matrix[i, j, 1] = np.median(data2)
			else:
				means_matrix[i, j, 1] = np.nan
				medians_matrix[i, j, 1] = np.nan
			
			if i == j:  # Same order comparison (diagonal)
				stat_matrix[i, j] = np.nan
				pval_matrix[i, j] = np.nan
			else:
				# Need at least 1 data point in each group
				if len(data1) > 0 and len(data2) > 0:
					stat, p = stats.mannwhitneyu(data1, data2, alternative='two-sided')
					stat_matrix[i, j] = stat
					pval_matrix[i, j] = p
				else:
					stat_matrix[i, j] = np.nan
					pval_matrix[i, j] = np.nan
	
	# Create a grid for the matrix
	ax.set_xlim(-0.5, 2.5)
	ax.set_ylim(-0.5, 2.5)
	
	# Draw grid lines
	for i in range(4):
		ax.axhline(i-0.5, color='black', linewidth=1)
		ax.axvline(i-0.5, color='black', linewidth=1)
	
	# Fill cells with results
	for i in range(3):
		for j in range(3):
			if i == j:  # Diagonal
				color = 'lightgray'
				n = counts_matrix[i, j, 0]  # Sample size for this order
				if n > 0:
					mean = means_matrix[i, j, 0]
					median = medians_matrix[i, j, 0]
					text = f"Order {orders[i]}\nN={int(n)}\nMean={mean:.2f}\nMedian={median:.2f}"
				else:
					text = f"Order {orders[i]}\nN=0\nNo data"
			else:
				p = pval_matrix[i, j]
				n1 = counts_matrix[i, j, 0]  # Sample size for order i
				n2 = counts_matrix[i, j, 1]  # Sample size for order j
				
				if np.isnan(p) or n1 == 0 or n2 == 0:
					color = 'white'
					text = f"Order {orders[i]} vs {orders[j]}\nN1={int(n1)}, N2={int(n2)}\nInsufficient data"
				else:
					# Determine cell color based on significance
					if p < alpha:
						color = 'salmon'  # Significant
						significance = "Significant"
					else:
						color = 'lightgreen'  # Not significant
						significance = "Not significant"
					
					text = f"Order {orders[i]} vs {orders[j]}\nN1={int(n1)}, N2={int(n2)}\nU={stat_matrix[i, j]:.1f}, p={p:.3f}\n{significance}"
			
			# Create the cell
			rect = plt.Rectangle((j-0.5, 2-i-0.5), 1, 1, fill=True, color=color, alpha=0.7)
			ax.add_patch(rect)
			
			# Add text
			ax.text(j, 2-i, text, ha='center', va='center', fontsize=9)
	
	# Set labels
	ax.set_xticks([0, 1, 2])
	ax.set_xticklabels(['Order 1', 'Order 2', 'Order 3'])
	ax.set_yticks([0, 1, 2])
	ax.set_yticklabels(['Order 3', 'Order 2', 'Order 1'])
	
	# Set title
	ax.set_title(f'Mann-Whitney U Test: Task {task}, {column_name}')
	
	# Add legend
	red_patch = mpatches.Patch(color='salmon', alpha=0.7, label='Significant (p < 0.05)')
	green_patch = mpatches.Patch(color='lightgreen', alpha=0.7, label='Not Significant (p ≥ 0.05)')
	gray_patch = mpatches.Patch(color='lightgray', alpha=0.7, label='Same Order')
	white_patch = mpatches.Patch(color='white', alpha=0.7, label='Insufficient Data')
	
	ax.legend(handles=[red_patch, green_patch, gray_patch, white_patch], 
			  loc='upper center', bbox_to_anchor=(0.5, -0.1), ncol=2)
	
	plt.tight_layout()
	plt.show()
	
	return fig, ax, pval_matrix


def perform_mann_whitney_test_to_df(df, column_name, alpha=0.05, replace_zeros=False, alternative : {'two-sided', 'less', 'greater'} = 'two-sided'):
	"""
	Perform Mann-Whitney U tests comparing orders for a specific task and column.
	Display results in a colored matrix.
	
	Parameters:
	df (DataFrame): The pandas DataFrame
	column_name (str): The column to test
	alpha (float): Significance level, defaults to 0.05
	replace_zeros (bool): Whether to treat zeros as missing values
	"""
	

	tasks = ['A', 'B', 'C']

	all_results = []

	for task in tasks:

		# Filter dataframe for the specified task
		task_df = df[df['Task'] == task].copy()

		without_tool_order = 1
		with_tool_order = [2,3]
		# Replace zeros with NaN if requested
		if replace_zeros:
			task_df[column_name] = task_df[column_name].replace(0, np.nan)

		performed_with_tool = task_df[task_df['order'].isin(with_tool_order)][column_name].dropna()
		performed_without_tool = task_df[task_df['order'] == without_tool_order][column_name].dropna()

		# Mann-Whitney U test 
		stat, p = stats.mannwhitneyu(performed_with_tool, performed_without_tool, alternative=alternative)
		delta, res = cliffs_delta(performed_with_tool, performed_without_tool)
		
		all_results.append(pd.DataFrame({
			'Task': task,
			'W/': f"{performed_with_tool.mean():.2f} ± {performed_with_tool.std():.2f}",
			'W/O': f"{performed_without_tool.mean():.2f} ± {performed_without_tool.std():.2f}",
			"Cliff's δ": delta,
			'p-value': p
		}, index=[0]))
	# Concatenate all results into a single DataFrame
	results_df = pd.concat(all_results, ignore_index=True)
	return results_df

def perform_mann_whitney_test_seperate_to_df(df, column_name, alpha=0.05, replace_zeros=False, alternative : {'two-sided', 'less', 'greater'} = 'two-sided'):
	"""
	Perform Mann-Whitney U tests comparing orders for a specific task and column.
	Display results in a colored matrix.
	
	Parameters:
	df (DataFrame): The pandas DataFrame
	column_name (str): The column to test
	alpha (float): Significance level, defaults to 0.05
	replace_zeros (bool): Whether to treat zeros as missing values
	"""

	tasks = ['A', 'B', 'C']

	all_results = []

	for task in tasks:

		# Filter dataframe for the specified task
		task_df = df[df['Task'] == task].copy()

		# Replace zeros with NaN if requested
		if replace_zeros:
			task_df[column_name] = task_df[column_name].replace(0, np.nan)

		tests = [(1,2), (1,3), (2,3)]
		means = [f"{task_df[task_df['order'] == order][column_name].dropna().mean():.2f} ± {task_df[task_df['order'] == order][column_name].dropna().std():.2f}" for order in [1,2,3]]
		task_results = []
		for order1, order2 in tests:
			# Perform Mann-Whitney U test 
			performed_with_tool = task_df[task_df['order'] == order2][column_name].dropna()
			performed_without_tool = task_df[task_df['order'] == order1][column_name].dropna()

			stat, p = stats.mannwhitneyu(performed_with_tool, performed_without_tool, alternative=alternative)
			delta, res = cliffs_delta(performed_with_tool, performed_without_tool)
			task_results.append((p, delta, res))

		all_results.append(pd.DataFrame({
			'Task': task,
			'1': means[0],
			'2': means[1],
			'3': means[2],
			'1vs2 p-value': task_results[0][0],
			'1vs3 p-value': task_results[1][0],
			'2vs3 p-value': task_results[2][0],
		}, index=[0]))

	# Concatenate all results into a single DataFrame
	results_df = pd.concat(all_results, ignore_index=True)
	return results_df

def perform_test_and_save_latex(df, column_name, alpha=0.05, replace_zeros=False, alternative : {'two-sided', 'less', 'greater'} = 'two-sided', pooled=True):
	if pooled:
		res = perform_mann_whitney_test_to_df(df, column_name=column_name, alpha=alpha, replace_zeros=replace_zeros, alternative=alternative)
	else:
		res = perform_mann_whitney_test_seperate_to_df(df, column_name=column_name, alpha=alpha, replace_zeros=replace_zeros, alternative=alternative)
		
	# create latex table from the results
	res.to_latex(f'table_results/{column_name}_mann_whitney_u{"_pooled" if pooled else ""}.tex', index=False, float_format="%.3f", escape=False)
	return res


def display_styled_results_tables(results, alpha=0.05):
	"""
	Display styled tables of Mann-Whitney U test results with color highlighting for significant p-values.
	
	Parameters:
	results (list): List of tuples (metric_name, pooled_results, separate_results)
	alpha (float): Significance level, defaults to 0.05
	"""
	
	# Function to highlight significant p-values
	def highlight_significant(val):
		if isinstance(val, float) and val < alpha:
			return 'background-color: #00aa00'  # Light red
		return ''
	
	for metric_name, pooled_results, separate_results in results:
		# Display section header
		display(HTML(f"<h3>{metric_name}</h3>"))
		
		# Display pooled results (Tool vs No-Tool)
		display(HTML("<h4>Combined Orders 2 & 3 (With Tool) vs Order 1 (Without Tool)</h4>"))
		styled_pooled = pooled_results.style.applymap(
			highlight_significant, 
			subset=pd.IndexSlice[:, ['p-value']]
		).format({
			'statistic': '{:.2f}',
			'p-value': '{:.4f}'
		})
		display(styled_pooled)
		
		# Display separate results (Order comparisons)
		display(HTML("<h4>Pairwise Order Comparisons</h4>"))
		styled_separate = separate_results.style.applymap(
			highlight_significant, 
			subset=pd.IndexSlice[:, ['1vs2 p-value', '1vs3 p-value', '2vs3 p-value']]
		).format({
			'1vs2 p-value': '{:.4f}',
			'1vs3 p-value': '{:.4f}',
			'2vs3 p-value': '{:.4f}'
		})
		display(styled_separate)
		
		# Add spacing between metrics
		display(HTML("<hr>"))
		

def Kaplan_Meier_by_task(df):
	tasks = ['A', 'B', 'C']

	#create three plots next to each other
	fig, axes = plt.subplots(1, 3, figsize=(15, 5))
	fig.subplots_adjust(wspace=0.3)
	# Set the title for the entire figure
	fig.suptitle('Kaplan-Meier Cumulative Density Curves for Tasks A, B, and C', fontsize=16)

	for task in tasks:
		task_df = df[df['Task'] == task].copy()


		for name, group_df in task_df.groupby('tool'):
			kf = KaplanMeierFitter()
			# Get the index of the subplot for this task
			subplot_idx = ord(task) - ord('A')  # A->0, B->1, C->2
			ax = axes[subplot_idx]  # Get the correct subplot
			
			# Fit the model and plot to the specific axis
			kf.fit(durations=group_df['time'], event_observed=group_df['event'], 
				   label='With Tool' if name == 1 else 'Without Tool')
			kf.plot_cumulative_density(ax=ax)
			
			# Set the title for this specific subplot
			ax.set_title(f'Task {task}')

def log_rank_for_task(df, yAxis=None):

	tasks = ['A', 'B', 'C']

	results = []

	#create three plots next to each other
	fig, axes = plt.subplots(2, 2, figsize=(15, 8))
	fig.subplots_adjust(wspace=0.3, hspace=0.4)
	# Set the title for the entire figure
	fig.suptitle('Kaplan-Meier Cumulative Density Curves for Tasks A, B, and C', fontsize=16)

	for task in tasks:
		task_df = df[df['Task'] == task].copy()


		for name, group_df in task_df.groupby('tool'):
			kf = KaplanMeierFitter()
			# Get the index of the subplot for this task
			subplot_idx = ord(task) - ord('A')  # A->0, B->1, C->2
			ax = axes[0 if subplot_idx < 2 else 1, 0 if subplot_idx % 2 == 0 else 1]  # Get the correct subplot
			
			# Fit the model and plot to the specific axis
			kf.fit(durations=group_df['time'], event_observed=group_df['event'], 
				   label='With Tool' if name == 1 else 'Without Tool')
			kf.plot_cumulative_density(ax=ax)
			
            # Set the y-axis label if provided
			if yAxis is not None:
				ax.set_ylabel(yAxis)
			
			# Set the title for this specific subplot
			ax.set_title(f'Task {task}')


		# Perform log-rank test
		results.append(logrank_test(task_df[task_df['tool'] == 0]['time'], task_df[task_df['tool'] == 1]['time'],
					 event_observed_A=task_df[task_df['tool'] == 0]['event'],
					 event_observed_B=task_df[task_df['tool'] == 1]['event']))
		
	
	task_df = df.copy()
	for name, group_df in task_df.groupby('tool'):
		kf = KaplanMeierFitter()
		# Get the index of the subplot for this task
		subplot_idx = (1,1)
		ax = axes[subplot_idx]  # Get the correct subplot
		
		# Fit the model and plot to the specific axis
		kf.fit(durations=group_df['time'], event_observed=group_df['event'], 
			   label='With Tool' if name == 1 else 'Without Tool')
		kf.plot_cumulative_density(ax=ax)
		
        # Set the y-axis label if provided
		if yAxis is not None:
			ax.set_ylabel(yAxis)

		print(kf.cumulative_density_at_times([180, 300], label=f'Total Density at 180s and 300s'))
		
		# Set the title for this specific subplot
		ax.set_title(f'All tasks pooled')

	# Perform log-rank test
	results.append(logrank_test(task_df[task_df['tool'] == 0]['time'], task_df[task_df['tool'] == 1]['time'],
				 event_observed_A=task_df[task_df['tool'] == 0]['event'],
				 event_observed_B=task_df[task_df['tool'] == 1]['event']))
		
	return results


def survival_analysis(df, column_of_interest, nan_fill_value=0, replace_zeros=True, yAxis=None):
	"""
	Perform survival analysis on the specified column of interest in the DataFrame.
	
	Parameters:
	df (DataFrame): The pandas DataFrame
	column_of_interest (str): The column to analyze
	"""
	df_survival = df.copy()
	df_survival['tool'] = df_survival['order'].apply(lambda x: 0 if x == 1 else 1)
	df_survival['event'] = df_survival[column_of_interest].notna().astype(int)
	
	if replace_zeros:
		# Replace zeros with NaN if requested
		df_survival['time'] = df_survival[column_of_interest].replace(0, np.nan)
		df_survival['time'] = df_survival[column_of_interest].replace(0.0, np.nan)
	
	print(df_survival['time'].isna().sum())
	
	df_survival['time'] = df_survival['time'].fillna(nan_fill_value)
	
	df_survival = df_survival[['name', 'Task', 'tool', 'event', 'time']]

	log_rank_results = log_rank_for_task(df_survival, yAxis=yAxis)

	log_rank_dfs = []
	for i, res in enumerate(log_rank_results):
		res.print_summary()
		log_rank_dfs.append(res.summary)
		log_rank_dfs[-1]['Task'] = f'{["A", "B", "C", "all pooled"][i]}'
		print(f"{['Task A', 'Task B', 'Task C', 'All tasks pooled'][i]} Test statistic: {res.test_statistic}, p-value: {res.p_value}")


	t = pd.concat(log_rank_dfs)
	t = t[['Task'] + [col for col in t.columns if col != 'Task']]
	t.to_latex(f'table_results/{column_of_interest}_log_rank_test.tex', index=False, float_format="%.4f", escape=False)
	plt.show()

	print()
	print()

	results = []

	for task in ['A', 'B', 'C']:
		print(f"Task {task}")
		temp_df = df_survival[df_survival['Task'] == task].drop(columns=['Task', 'name'])
		cph = CoxPHFitter(penalizer=0.1)
		cph.fit(temp_df, duration_col = 'time', event_col = 'event')
		cph.print_summary()

		plt.show()

		print()

		cph.check_assumptions(temp_df, show_plots=True, p_value_threshold=0.05);

		plt.show()

		results.append(cph.summary)
		results[-1]['Task'] = f'{task}'

		print()
		print()

	print(f"All Tasks pooled")
	temp_df = df_survival.drop(columns=['Task', 'name'])
	cph = CoxPHFitter()
	cph.fit(temp_df, duration_col = 'time', event_col = 'event')
	cph.print_summary()
	print()
	cph.check_assumptions(temp_df, show_plots=True, p_value_threshold=0.05);
	results.append(cph.summary)
	results[-1]['Task'] = 'All Tasks pooled'

	t = pd.concat(results)
	t = t[['Task'] + [col for col in t.columns if col != 'Task']]
	t.to_latex(f'table_results/{column_of_interest}_coxPH.tex',
			columns=['Task', 'coef', 'exp(coef)', 'coef lower 95%', 'coef upper 95%', 'cmp to', 'z', 'p'],
			index=True, 
			float_format="%.4f", 
			escape=False)
	return results

def plot_likert_scale(df, columns_to_plot, tick_labels=None, likert_scale_points=7,
                      colors=None, figure_size=(10, 6), bar_height=0.8,
                      legend_title='Response', axis_label_fontsize=12,
                      title_fontsize=14, tick_label_fontsize=10,
                      legend_fontsize=10,
                      custom_legend_labels=None):
    """
    Args:
        df (pd.DataFrame): The DataFrame containing the Likert scale data.
        columns_to_plot (list): A list of column names in the DataFrame to plot.
                                  Each column should represent a Likert scale question.
        likert_scale_points (int, optional): The number of points on the Likert scale.
                                             Defaults to 7.
        colors (list, optional): A list of colors for the Likert scale categories.
                                 If None, a default diverging palette will be used.
                                 The list should have `likert_scale_points` colors,
                                 ordered from most negative to most positive.
        figure_size (tuple, optional): The size of the plot (width, height).
                                       Defaults to (10, 6).
        bar_height (float, optional): The height of the bars in the bar chart.
                                      Defaults to 0.8.
        legend_title (str, optional): The title for the legend. Defaults to 'Response'.
        axis_label_fontsize (int, optional): Font size for axis labels. Defaults to 12.
        title_fontsize (int, optional): Font size for the plot title. Defaults to 14.
        tick_label_fontsize (int, optional): Font size for tick labels. Defaults to 10.
        legend_fontsize (int, optional): Font size for legend labels. Defaults to 10.
        custom_legend_labels (list, optional): A list of strings for legend labels,
                                              ordered from most negative to most positive.
                                              If None, defaults will be generated.

    Returns:
        matplotlib.figure.Figure: The matplotlib Figure object containing the plot.
        matplotlib.axes.Axes: The matplotlib Axes object containing the plot.

    Raises:
        ValueError: If `columns_to_plot` is empty or not a list.
        ValueError: If any column in `columns_to_plot` is not in the DataFrame.
        ValueError: If `likert_scale_points` is less than 3.
        ValueError: If `colors` is provided and its length doesn't match `likert_scale_points`.
        ValueError: If `custom_legend_labels` is provided and its length doesn't match `likert_scale_points`.
    """
    if not columns_to_plot or not isinstance(columns_to_plot, list):
        raise ValueError("columns_to_plot must be a non-empty list of column names.")

    for col in columns_to_plot:
        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found in the DataFrame.")

    if likert_scale_points < 3:
        raise ValueError("likert_scale_points must be at least 3.")

    if colors and len(colors) != likert_scale_points:
        raise ValueError(f"The length of 'colors' must be equal to 'likert_scale_points' ({likert_scale_points}).")

    if custom_legend_labels and len(custom_legend_labels) != likert_scale_points:
        raise ValueError(f"The length of 'custom_legend_labels' must be equal to 'likert_scale_points' ({likert_scale_points}).")

    # Prepare data
    percentages = []
    counts_data = [] # To store actual counts
    for col in columns_to_plot:
        total_responses = df[col].count() # Total non-null responses for the question
        counts = df[col].value_counts().sort_index()
        percent = counts.apply(lambda x: (x / total_responses) * 100) if total_responses > 0 else pd.Series(0.0, index=range(1, likert_scale_points + 1))

        # Ensure all likert points are present, fill with 0 if not
        full_percent = pd.Series(0.0, index=range(1, likert_scale_points + 1))
        full_percent.update(percent)
        percentages.append(full_percent)

        full_counts = pd.Series(0, index=range(1, likert_scale_points + 1), dtype=int)
        full_counts.update(counts)
        counts_data.append(full_counts)

    plot_data_percentages = pd.DataFrame(percentages, index=columns_to_plot)
    plot_data_counts = pd.DataFrame(counts_data, index=columns_to_plot) # DataFrame for counts

    num_questions = len(columns_to_plot)
    mid_point_idx = (likert_scale_points - 1) // 2

    if colors is None:
        if likert_scale_points % 2 == 0: # Even scale, no true center
            # For even scales, a sequential palette might be less misleading than diverging around a non-existent center
            # Or use a diverging palette that implies a split between two central categories
            try:
                colors = sns.color_palette(f"coolwarm_r", likert_scale_points).as_hex()
            except: # Fallback if specific seaborn version/palette issue
                colors = plt.cm.get_cmap('coolwarm_r', likert_scale_points)(np.linspace(0, 1, likert_scale_points))
        else: # Odd scale, has a center
            try:
                colors = sns.color_palette(f"coolwarm_r", likert_scale_points).as_hex()
            except:
                 colors = plt.cm.get_cmap('coolwarm_r', likert_scale_points)(np.linspace(0, 1, likert_scale_points))
    
    # Define legend labels
    if custom_legend_labels:
        legend_labels = custom_legend_labels
    else:
        if likert_scale_points == 7:
            legend_labels = ['Strongly Disagree', 'Disagree', 'Somewhat Disagree', 'Neutral', 'Somewhat Agree', 'Agree', 'Strongly Agree']
        elif likert_scale_points == 5:
            legend_labels = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']
        elif likert_scale_points == 4:
            legend_labels = ['Strongly Disagree', 'Disagree', 'Agree', 'Strongly Agree']
        elif likert_scale_points == 6:
            legend_labels = ['Strongly Disagree', 'Disagree', 'Slightly Disagree', 'Slightly Agree', 'Agree', 'Strongly Agree']
        else:
            legend_labels = [f'Level {i}' for i in range(1, likert_scale_points + 1)]


    fig, ax = plt.subplots(figsize=figure_size)
    y_pos = np.arange(num_questions)

    # Plotting negative side (from center outwards to the left)
    current_negative_offset = np.zeros(num_questions)
    if likert_scale_points % 2 != 0: # If there's a neutral category (odd number of points)
        neutral_percentages = plot_data_percentages.iloc[:, mid_point_idx].values
        neutral_counts = plot_data_counts.iloc[:, mid_point_idx].values
        neutral_half_percentages = neutral_percentages / 2
        # Plot left half of neutral
        rects = ax.barh(y_pos, neutral_half_percentages, left=-neutral_half_percentages, color=colors[mid_point_idx],
                height=bar_height, label=legend_labels[mid_point_idx])
        current_negative_offset = -neutral_half_percentages

        # Add text for neutral category (centered on the full neutral bar)
        for j, (rect, count) in enumerate(zip(rects, neutral_counts)):
            if neutral_percentages[j] > 0: # Only label if there's a value
                x_val = -rect.get_width() / 2 # Center within its own half
                ax.text(x_val, rect.get_y() + rect.get_height()/2, f'{count}',
                        ha='center', va='center', fontsize=tick_label_fontsize-2, color='black',)
                        #bbox=dict(facecolor='white', alpha=0.5, edgecolor='none', boxstyle='round,pad=0.2'))

    for i in range(mid_point_idx - 1, -1, -1): # Iterate from (mid-1) down to 0
        percentages = plot_data_percentages.iloc[:, i].values
        counts = plot_data_counts.iloc[:, i].values
        rects = ax.barh(y_pos, percentages, left=current_negative_offset - percentages, color=colors[i],
                height=bar_height, label=legend_labels[i])
        current_negative_offset -= percentages

        # Add text for negative categories
        for j, (rect, count) in enumerate(zip(rects, counts)):
            if percentages[j] > 0:
                x_val = rect.get_x() + rect.get_width() / 2
                ax.text(x_val, rect.get_y() + rect.get_height()/2, f'{count}',
                        ha='center', va='center', fontsize=tick_label_fontsize-2, color='white',)
                        #bbox=dict(facecolor='black', alpha=0.5, edgecolor='none', boxstyle='round,pad=0.2'))

    # Plotting positive side (from center outwards to the right)
    current_positive_offset = np.zeros(num_questions)
    if likert_scale_points % 2 != 0: # If there's a neutral category
        neutral_percentages = plot_data_percentages.iloc[:, mid_point_idx].values
        neutral_counts = plot_data_counts.iloc[:, mid_point_idx].values
        neutral_half_percentages = neutral_percentages / 2
        # Plot right half of neutral - ***CORRECTED HERE: NO LABEL***
        rects = ax.barh(y_pos, neutral_half_percentages, left=0, color=colors[mid_point_idx],
                height=bar_height) # Removed 'label' and 'handle_hidden'
        current_positive_offset = neutral_half_percentages
        # Note: neutral count is already handled for the left half, no need to duplicate

    start_idx_positive = mid_point_idx + 1 if likert_scale_points % 2 != 0 else mid_point_idx
    for i in range(start_idx_positive, likert_scale_points):
        percentages = plot_data_percentages.iloc[:, i].values
        counts = plot_data_counts.iloc[:, i].values
        rects = ax.barh(y_pos, percentages, left=current_positive_offset, color=colors[i],
                height=bar_height, label=legend_labels[i])
        current_positive_offset += percentages

        # Add text for positive categories
        for j, (rect, count) in enumerate(zip(rects, counts)):
            if percentages[j] > 0:
                x_val = rect.get_x() + rect.get_width() / 2
                ax.text(x_val, rect.get_y() + rect.get_height()/2, f'{count}',
                        ha='center', va='center', fontsize=tick_label_fontsize-2, color='white')
                        #bbox=dict(facecolor='black', alpha=0.5, edgecolor='none', boxstyle='round,pad=0.2'))


    ax.set_yticks(y_pos)
    tick_labels = tick_labels if tick_labels else plot_data_percentages.index
    ax.set_yticklabels(tick_labels, fontsize=tick_label_fontsize)
    ax.invert_yaxis()

    # Calculate total responses per question and add as a label to the right of each bar
    for j, question_name in enumerate(columns_to_plot):
        total_q_responses = df[question_name].count() # Total non-null responses
        ax.text(current_positive_offset[j] + 2, y_pos[j], f'n={total_q_responses}',
                ha='left', va='center', fontsize=tick_label_fontsize, color='gray')


    max_neg_val = np.abs(current_negative_offset.min()) if num_questions > 0 else 50
    max_pos_val = current_positive_offset.max() if num_questions > 0 else 50
    max_abs_val = max(max_neg_val, max_pos_val, 50) # Ensure a default range if data is all zero

    ax.set_xlim(-max_abs_val - 10, max_abs_val + 15) # Add more padding for total counts
    ax.axvline(0, color='grey', linestyle='--', linewidth=0.8)

    ax.set_xlabel('Percentage (%)', fontsize=axis_label_fontsize)
    if len(columns_to_plot) == 1:
        title = f'Likert Scale Responses for: {columns_to_plot[0]}'
    else:
        title = f'Likert Scale Responses ({likert_scale_points}-point)'
    ax.set_title(title, fontsize=title_fontsize)

    handles, labels_from_plot = ax.get_legend_handles_labels()

    # Create a dictionary to map labels from plot to their handles
    handle_dict = dict(zip(labels_from_plot, handles))

    # Filter and order handles based on our predefined legend_labels list
    ordered_handles = [handle_dict[lbl] for lbl in legend_labels if lbl in handle_dict]
    ordered_labels_for_legend = [lbl for lbl in legend_labels if lbl in handle_dict]

    ax.legend(ordered_handles, ordered_labels_for_legend, title=legend_title,
              bbox_to_anchor=(1.05, 1), loc='upper left', borderaxespad=0.,
              fontsize=legend_fontsize, title_fontsize=legend_fontsize)

    sns.despine(left=True, bottom=False, ax=ax) # Keep bottom axis line if percentages are shown
    ax.tick_params(axis='x', which='major', labelsize=tick_label_fontsize)
    ax.grid(axis='x', linestyle=':', color='gray', alpha=0.6)

    plt.tight_layout(rect=[0, 0, 0.85, 1]) # Adjust layout for legend

    return fig, ax